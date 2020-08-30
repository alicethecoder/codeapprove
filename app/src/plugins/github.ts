import { Octokit } from "@octokit/rest";
import { graphql } from "@octokit/graphql";
import {
  SearchUsersResponseData,
  UsersGetAuthenticatedResponseData,
  PullsGetResponseData,
  PullsListCommitsResponseData
} from "@octokit/types";
import parseDiff from "parse-diff";

import AuthModule from "@/store/modules/auth";
import * as octocache from "./octocache";
import { freezeArray } from "./freeze";
import { config } from "./config";

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

export class Github {
  private octokit!: Octokit;
  private gql: typeof graphql = graphql;

  constructor(private authModule: AuthModule) {
    const token = authModule.assertUser.githubToken;
    this.applyAuth(token);
  }

  private applyAuth(token: string) {
    this.octokit = new Octokit({ auth: token, previews: PREVIEWS });
    this.gql = this.gql.defaults({
      headers: {
        authorization: `token ${token}`
      }
    });
  }

  async assertAuth(): Promise<void> {
    const now = new Date().getTime();
    const expires = this.authModule.assertUser.githubExpiry;
    const until = expires - now;

    const hourMs = 60 * 60 * 1000;

    // TODO: This does not seem to save the expiry!
    // Refresh if it will expire in the next hour
    if (until < hourMs) {
      console.log(
        `Token expires in ${expires} - ${now} = ${until}ms, refreshing authentication`
      );
      await this.authModule.refreshGithubAuth();
      this.applyAuth(this.authModule.assertUser.githubToken);
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
      repo
    });

    // Filter users for the prefix
    const collabsFiltered = collabs.data.filter(x => x.login.includes(prefix));

    // List random GitHub users
    const random = await this.octokit.search.users({
      q: prefix,
      per_page: 5
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
        access_level
      });
    }

    for (const c of random.data.items) {
      if (!res.some(x => x.login === c.login)) {
        res.push({
          login: c.login,
          avatar_url: c.avatar_url,
          collaborator: false,
          access_level: "none"
        });
      }
    }

    return res;
  }

  async getPullRequest(
    owner: string,
    repo: string,
    pull_number: number
  ): Promise<PullRequestData> {
    await this.assertAuth();

    const pr = await this.octokit.pulls.get({
      owner,
      repo,
      pull_number
    });

    const diffs = await this.getDiff(
      owner,
      repo,
      pr.data.base.ref,
      pr.data.head.ref
    );

    const commits = await this.octokit.pulls.listCommits({
      owner,
      repo,
      pull_number
    });

    // TODO: Diff should be separate
    return {
      pr: Object.freeze(pr.data),
      commits: freezeArray(commits.data),
      diffs: freezeArray(diffs)
    };
  }

  async getDiff(
    owner: string,
    repo: string,
    base: string,
    head: string
  ): Promise<parseDiff.File[]> {
    await this.assertAuth();

    const res = await this.octokit.repos.compareCommits({
      owner,
      repo,
      base,
      head,
      mediaType: {
        format: "diff"
      }
    });

    // The strange header changes the response type
    const data = (res.data as unknown) as string;
    return parseDiff(data);
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
        ref
      }
    );

    if (data.encoding === "base64") {
      return atob(data.content);
    }

    console.warn("Unknown encoding :" + data.encoding);
    return "";
  }

  async getInstallations(): Promise<InstallationStatus> {
    await this.assertAuth();

    const installRes = await this.octokit.apps.listInstallationsForAuthenticatedUser();
    const installation = installRes.data.installations.find(
      i => i.app_id === config.github.app_id
    );

    if (!installation) {
      return {
        installed: false
      };
    }

    const repoRes = await this.octokit.apps.listInstallationReposForAuthenticatedUser(
      {
        installation_id: installation.id
      }
    );

    const res = {
      installed: true,
      installation: {
        id: installation.id,
        url: installation.html_url
      },
      repositories: repoRes.data.repositories.map(r => {
        return { full_name: r.full_name };
      })
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
      }`
      })
    );

    const nodes = (res as any).search.edges
      .filter((e: any) => e != null)
      .map((e: any) => e.node);

    return nodes as PullRequestNode[];
  }
}
