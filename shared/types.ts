export interface Installation {
  installation_id: number;
  repo_id: number;
}

export interface ReviewMetadata {
  owner: string;
  repo: string;
  number: number;
  base: {
    label: string;
    sha: string;
  };
  head: {
    label: string;
    sha: string;
  };
}

// TODO: Need to flesh this out, this is what will go in Firestore
export interface ReviewDoc {
  reviewers: Record<string, boolean>;
}

// TODO: Need information about what is up to date (comment shas, etc)
export interface Review {
  metadata: ReviewMetadata;
  reviewers: Record<string, boolean>;
  threads: Thread[];
  comments: Comment[];
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
