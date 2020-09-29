import { Octokit } from "@octokit/rest";
import { graphql } from "@octokit/graphql";
import {
  UsersGetAuthenticatedResponseData,
  PullsGetResponseData,
  PullsListCommitsResponseData,
} from "@octokit/types";
import parseDiff from "parse-diff";

import * as octocache from "./octocache";
import { freezeArray } from "./freeze";

const PREVIEWS = ["machine-man-preview"];

export interface PullRequestData {
  pr: PullsGetResponseData;
  commits: PullsListCommitsResponseData;
  diffs: parseDiff.File[];
}

export interface PullRequestNode {
  title: string;
  number: number;
  repository: {
    owner: {
      login: string;
    };
    name: string;
  };
  closed: boolean;
  merged: boolean;
  updatedAt: string;
}

export type InstallationStatus =
  | NoInstallationStatus
  | SuccessfulInstallationStatus;

export interface NoInstallationStatus {
  installed: false;
}

export interface SuccessfulInstallationStatus {
  installed: true;
  installation: {
    id: number;
    url: string;
  };
  repositories: {
    full_name: string;
  }[];
}

export interface UserSearchItem {
  login: string;
  avatar_url: string;
  collaborator: boolean;
  access_level: "admin" | "write" | "read" | "none";
}

export interface AuthDelegate {
  getExpiry(): number;
  getToken(): string;
  refreshAuth(): Promise<any>;
}

export class Github {
  private octokit!: Octokit;
  private gql: typeof graphql = graphql;

  constructor(private authDelegate: AuthDelegate, private githubAppId: number) {
    this.applyAuth(this.authDelegate.getToken());
  }

  private applyAuth(token: string) {
    this.octokit = new Octokit({ auth: token, previews: PREVIEWS });
    this.gql = this.gql.defaults({
      headers: {
        authorization: `token ${token}`,
      },
    });
  }

  async assertAuth(): Promise<void> {
    const now = new Date().getTime();
    const expires = this.authDelegate.getExpiry();
    const until = expires - now;

    const hourMs = 60 * 60 * 1000;

    // Refresh if it will expire in the next hour
    if (until < hourMs) {
      console.log(
        `Token expires in ${expires} - ${now} = ${until}ms, refreshing authentication`
      );
      await this.authDelegate.refreshAuth();
      this.applyAuth(this.authDelegate.getToken());
    }
  }

  async me(): Promise<UsersGetAuthenticatedResponseData> {
    const res = await this.octokit.users.getAuthenticated();
    return res.data;
  }

  async searchUsers(
    owner: string,
    repo: string,
    prefix: string
  ): Promise<UserSearchItem[]> {
    await this.assertAuth();

    // List users from the repo
    const collabs = await this.octokit.repos.listCollaborators({
      owner,
      repo,
    });

    // Filter users for the prefix
    const collabsFiltered = collabs.data.filter((x) =>
      x.login.includes(prefix)
    );

    // List random GitHub users
    const random = await this.octokit.search.users({
      q: prefix,
      per_page: 5,
    });

    const res: UserSearchItem[] = [];

    for (const c of collabsFiltered) {
      const access_level = c.permissions.admin
        ? "admin"
        : c.permissions.push
        ? "write"
        : c.permissions.pull
        ? "read"
        : "none";

      res.push({
        login: c.login,
        avatar_url: c.avatar_url,
        collaborator: true,
        access_level,
      });
    }

    for (const c of random.data.items) {
      if (!res.some((x) => x.login === c.login)) {
        res.push({
          login: c.login,
          avatar_url: c.avatar_url,
          collaborator: false,
          access_level: "none",
        });
      }
    }

    return res;
  }

  async getPullRequestMetadata(
    owner: string,
    repo: string,
    pull_number: number
  ) {
    await this.assertAuth();

    const res = await this.octokit.pulls.get({ owner, repo, pull_number });
    return res.data;
  }

  async getPullRequest(
    owner: string,
    repo: string,
    pull_number: number
  ): Promise<PullRequestData> {
    await this.assertAuth();

    const pr = await this.getPullRequestMetadata(owner, repo, pull_number);

    // The label is "owner:branch" so that this works with forks as well
    const diffs = await this.getDiff(owner, repo, pr.base.label, pr.head.label);

    const commits = await this.octokit.pulls.listCommits({
      owner,
      repo,
      pull_number,
    });

    // TODO: Diff should be separate
    return {
      pr: Object.freeze(pr),
      commits: freezeArray(commits.data),
      diffs: freezeArray(diffs),
    };
  }

  async getDiff(
    owner: string,
    repo: string,
    base: string,
    head: string
  ): Promise<parseDiff.File[]> {
    await this.assertAuth();

    const res = await octocache.call(
      "repos.compareCommits",
      this.octokit.repos.compareCommits,
      {
        owner,
        repo,
        base,
        head,
        mediaType: {
          format: "diff",
        },
      }
    );

    // The strange header changes the response type
    const data = (res as unknown) as string;
    return parseDiff(data);
  }

  // TODO: Move this somewhere the server can get to it
  async translateLineNumber(
    owner: string,
    repo: string,
    base: string,
    head: string,
    file: string,
    line: number
  ) {
    const diff = await this.getDiff(owner, repo, base, head);
    const fileDiff = diff.find((f) => f.from === file);
    if (!fileDiff) {
      return -1;
    }

    // If the line in question is before the start of the diff, number is unchanged
    const firstLine = fileDiff.chunks[0].oldStart;
    if (line < firstLine) {
      return line;
    }

    // Keep track of how many lines are added/deleted (net) above the line
    let nudge = 0;

    for (const chunk of fileDiff.chunks) {
      for (const change of chunk.changes) {
        // Loop until one of:
        // a) We find a normal block that's an exact match
        // b) We find a normal block that's after the line in question,
        //    letting us know that we passed it and we can apply the nudge
        switch (change.type) {
          case "normal":
            if (change.ln1 === line) {
              return change.ln2;
            } else if (change.ln1 > line) {
              return line + nudge;
            }
            break;
          case "add":
            nudge += 1;
            break;
          case "del":
            nudge -= 1;
            break;
        }
      }
    }

    // If we get here it's off the end of the diff, just apply the nudge
    return line + nudge;
  }

  async getContentLines(
    owner: string,
    repo: string,
    path: string,
    ref: string,
    start: number,
    end: number
  ): Promise<string[]> {
    await this.assertAuth();

    console.log(`getContentLines(${path}@${ref}, ${start}, ${end})`);

    const content = await this.getContent(owner, repo, path, ref);
    const lines = content.split("\n");

    // File lines are one-indexed (start - 1) but end is exclusive
    const slice = lines.slice(start - 1, end);
    return slice;
  }

  async getContent(
    owner: string,
    repo: string,
    path: string,
    ref: string
  ): Promise<string> {
    await this.assertAuth();

    const data = await octocache.call(
      "repos.getContent",
      this.octokit.repos.getContent,
      {
        owner,
        repo,
        path,
        ref,
      }
    );

    if (data.encoding === "base64") {
      if (window && window.atob) {
        // Browser
        return window.atob(data.content);
      } else {
        // Node
        return new Buffer(data.content, "base64").toString("utf-8");
      }
    }

    console.warn("Unknown encoding :" + data.encoding);
    return "";
  }

  async getInstallations(): Promise<InstallationStatus> {
    await this.assertAuth();

    const installRes = await this.octokit.apps.listInstallationsForAuthenticatedUser();
    const installation = installRes.data.installations.find(
      (i) => i.app_id === this.githubAppId
    );

    if (!installation) {
      return {
        installed: false,
      };
    }

    const repoRes = await this.octokit.apps.listInstallationReposForAuthenticatedUser(
      {
        installation_id: installation.id,
      }
    );

    const res = {
      installed: true,
      installation: {
        id: installation.id,
        url: installation.html_url,
      },
      repositories: repoRes.data.repositories.map((r) => {
        return { full_name: r.full_name };
      }),
    };

    return res;
  }

  async getAssignedPulls(login: string) {
    await this.assertAuth;
    return this.getPulls("review-requested", login);
  }

  async getOutgoingPulls(login: string) {
    await this.assertAuth();
    return this.getPulls("author", login);
  }

  async executeGql(req: ReturnType<typeof graphql>) {
    try {
      // TODO: Types!
      return await req;
    } catch (e) {
      if (e.data) {
        console.warn(`Partial GraphQL response: ${e.message}`);
        console.warn(e.request);
        return e.data;
      }

      throw e;
    }
  }

  // TODO: These params should be GQL variables not format strings...
  async getPulls(filter: "review-requested" | "author", login: string) {
    await this.assertAuth();

    const res = await this.executeGql(
      this.gql({
        query: `query pulls {
        search(query: "is:pull-request is:open ${filter}:${login}", type: ISSUE, last: 25) {
          edges {
            node {
              ... on PullRequest {
                title
                number
                repository {
                  owner {
                    login
                  }
                  name
                },
                closed
                merged
                updatedAt
              }
            }
          }
        }
      }`,
      })
    );

    const nodes = (res as any).search.edges
      .filter((e: any) => e != null)
      .map((e: any) => e.node);

    return nodes as PullRequestNode[];
  }
}
