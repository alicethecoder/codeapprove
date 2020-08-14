import { Octokit } from "@octokit/rest";
import { graphql } from "@octokit/graphql";
import {
  SearchUsersResponseData,
  UsersGetAuthenticatedResponseData,
  PullsGetResponseData,
  PullsListCommitsResponseData
} from "@octokit/types";
import parseDiff from "parse-diff";
import * as octocache from "./octocache";
import { freezeArray } from "./freeze";
import AuthModule from "@/store/modules/auth";

const PREVIEWS = ["machine-man-preview"];

export interface PullRequestData {
  pr: PullsGetResponseData;
  commits: PullsListCommitsResponseData;
  diffs: parseDiff.File[];
}

export class Github {
  private octokit!: Octokit;
  private gql!: typeof graphql;

  constructor(private authModule: AuthModule) {
    const token = authModule.assertUser.githubToken;
    this.applyAuth(token);
  }

  private applyAuth(token: string) {
    this.octokit = new Octokit({ auth: token, previews: PREVIEWS });
    this.gql = graphql.defaults({
      headers: {
        authorization: `token ${token}`
      }
    });
  }

  async assertAuth(): Promise<void> {
    const now = new Date().getTime();
    const until = this.authModule.assertUser.githubExpiry - now;

    const hourMs = 60 * 60 * 1000;

    // Refresh if it will expire in the next hour
    if (until < hourMs) {
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
  ): Promise<SearchUsersResponseData> {
    await this.assertAuth();

    // TODO: Prefer users from the same repo!
    const res = await this.octokit.search.users({
      q: prefix
    });

    return res.data;
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

  async getAssignedPulls() {
    await this.assertAuth();

    // TODO: Should be a gql variable but can't figure it out
    const login = "hatboysam";

    // TODO: This doesn't work for reviewed-by ...
    const res = await this.gql({
      query: `query pulls {
        search(query: "is:pull-request review-requested:${login}", type: ISSUE, last: 100) {
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
    });

    // Need more types
    return (res as any).search.edges.map((e: any) => e.node);
  }
}
