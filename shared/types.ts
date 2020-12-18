export interface Installation {
  installation_id: number;
  repo_id: number;
}

export interface ReviewMetadata {
  owner: string;
  repo: string;
  number: number;
  author: string;
  title: string;
  base: {
    label: string;
    sha: string;
  };
  head: {
    label: string;
    sha: string;
  };
  updated_at: number;
}

// Type representing incoming GitHub data (from API or WebHook) that
// we can use to construct a ReviewMetadata:
//  - owner/repo/author fields are added from elsewhere
//  - updated_at is a string on GitHub, we want a number for sorting
export type ReviewMetadataSource = Omit<
  ReviewMetadata,
  "owner" | "repo" | "author" | "updated_at"
> & {
  user: {
    login: string;
  };
  updated_at: string;
};

export enum ReviewStatus {
  // Approved and all comments resolved
  APPROVED = "approved",

  // Closed and all commits merged into the target branch
  CLOSED_MERGED = "closed_merged",

  // Closed before merging (abandoned)
  CLOSED_UNMERGED = "closed_unmerged",

  // Approved by someone, but has unresolved comments
  // TODO: Don't think this should be here, we should track unresolved as a separate boolean?
  NEEDS_RESOLUTION = "needs_resolution",

  // Has reviewers, but not yet approved by any
  NEEDS_APPROVAL = "needs_approval",

  // Nobody has reviewed this yet
  NEEDS_REVIEW = "needs_review",
}

export interface ReviewState {
  // Overall status
  status: ReviewStatus;

  // Open/closed state
  closed: boolean;

  // Anyone added as a reviewer
  reviewers: string[];

  // Those who have actually approved it
  approvers: string[];

  // Number of unresolved threads
  unresolved: number;
}

export interface Review {
  metadata: ReviewMetadata;
  state: ReviewState;
}

export interface ThreadPositionArgs {
  file: string;
  sha: string;
  line: number;
}

export interface ThreadContentArgs {
  lineContent: string;
}

export type ThreadArgs = ThreadPositionArgs & ThreadContentArgs;

export interface Thread {
  id: string;
  username: string;
  draft: boolean;
  resolved: boolean;
  pendingResolved: boolean;

  currentArgs: ThreadArgs;
  originalArgs: ThreadArgs;
}

export interface CommentUser {
  username: string;
  photoURL: string;
}

export interface Comment extends CommentUser {
  id: string;
  threadId: string;
  draft: boolean;
  timestamp: string;
  text: string;
}
