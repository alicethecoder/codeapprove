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
import { GithubConfig } from "./types";

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

export interface LineTranslation {
  file: string;
  line: number;
}

export class Github {
  private octokit!: Octokit;
  private gql: typeof graphql = graphql;

  constructor(
    private authDelegate: AuthDelegate,
    private githubConfig: GithubConfig
  ) {
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

  /**
   * Translate a line between two commits, used as more commits are pushed
   * onto the HEAD of the review.
   *
   * @param owner repo owner.
   * @param repo repo name.
   * @param oldHead the original commit (where you know the line number).
   * @param newHead the new commit (where you don't know the line number).
   * @param file the file name (in the original commit).
   * @param line the line number (in the original commit).
   */
  async translateLineNumberHeadMove(
    owner: string,
    repo: string,
    oldHead: string,
    newHead: string,
    file: string,
    line: number
  ): Promise<LineTranslation> {
    // Diff the two commits against each other to determine what changed
    const diff = await this.getDiff(owner, repo, oldHead, newHead);

    // Find the file in the 'from' list
    const fileDiff = diff.find((f) => f.from === file);
    if (!fileDiff) {
      return { file, line: -1 };
    }

    const newFileName = fileDiff.to || fileDiff.from || file;

    // Calculate of how many lines are added/deleted (net) above the line
    const nudge = this.calculateLineNudge(fileDiff, line);
    return {
      file: newFileName,
      line: line + nudge,
    };
  }

  /**
   * Translate a line from a review as the BASE of the review changes.
   *
   * @param owner the repo owner.
   * @param repo the repo name.
   * @param oldBase the previously known base commit.
   * @param newBase the current base commit.
   * @param file the file name.
   * @param line the line number (as currently known in head).
   */
  async translateLineNumberBaseMove(
    owner: string,
    repo: string,
    oldBase: string,
    newBase: string,
    file: string,
    line: number
  ) {
    // TODO(polish): This is extremely similar to the other method, DRY?

    // Diff the two commits against each other to determine what changed
    const diff = await this.getDiff(owner, repo, oldBase, newBase);

    // Find the file in the 'to' list
    const fileDiff = diff.find((f) => f.to === file);
    if (!fileDiff) {
      return { file, line: -1 };
    }

    // Calculate of how many lines are added/deleted (net) above the line
    const nudge = this.calculateLineNudge(fileDiff, line);
    return {
      file,
      line: line + nudge,
    };
  }

  /**
   * Determine how far a line has moved within a diff by counting lines above it
   * that have been added or deleted.
   */
  calculateLineNudge(fileDiff: parseDiff.File, line: number): number {
    // If the line in question is before the start of the diff, number is unchanged
    const firstLine = fileDiff.chunks[0].oldStart;
    if (line < firstLine) {
      return 0;
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
              // The diff tells us the exact new line number, so the nudge is the
              // difference.
              return change.ln2 - change.ln1;
            } else if (change.ln1 > line) {
              return nudge;
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

    // At this point the line is "off the end" of the diff so the nudge won't change
    return nudge;
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

    // File lines are 1-indexed in editors but 0-indexed in the array, hence start - 1
    // end is exclusive
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
      (i) => i.app_id === this.githubConfig.app_id
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

  async getOpenPulls(owner: string, repo: string) {
    await this.assertAuth();
    const pullsRes = await this.octokit.pulls.list({
      owner,
      repo,
      state: "open",
    });

    return pullsRes.data;
  }

  async reviewPullRequest(
    owner: string,
    repo: string,
    pull_number: number,
    event: "APPROVE" | "REQUEST_CHANGES",
    body: string
  ) {
    await this.assertAuth();

    // TODO(polish): Could store this in Firestore
    const res = await this.octokit.pulls.listReviews({
      owner,
      repo,
      pull_number,
      per_page: 100,
    });

    const reviews = res.data.sort((a, b) => {
      return Date.parse(b.submitted_at) - Date.parse(a.submitted_at);
    });

    const myLatestReview = reviews.find((r) => {
      return r.user.login === `${this.githubConfig.app_name}[bot]`;
    });

    const toState = event === "APPROVE" ? "APPROVED" : "CHANGES_REQUESTED";
    const leaveNewReview = !myLatestReview || myLatestReview.state !== toState;

    if (leaveNewReview) {
      console.log(`Creating new review`);
      await this.octokit.pulls.createReview({
        owner,
        repo,
        pull_number,
        event,
        body,
      });
    } else {
      console.log(`Updating existing review ${myLatestReview!.id}`);
      await this.octokit.pulls.updateReview({
        review_id: myLatestReview!.id,
        owner,
        repo,
        pull_number,
        body,
      });
    }
  }

  async executeGql(req: ReturnType<typeof graphql>) {
    try {
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

  // TODO(polish): These params should be GQL variables not format strings...
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
