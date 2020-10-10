export type Side = "left" | "right";

export interface SidePair<T> {
  left: T;
  right: T;
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

export interface LangPair extends SidePair<string> {}

export interface ThreadPair extends SidePair<Thread | null> {}

export function threadMatch(thread: Thread, args: ThreadPositionArgs): boolean {
  // TODO: Consider originalArgs?
  return (
    args.file === thread.currentArgs.file &&
    args.line === thread.currentArgs.line &&
    args.sha === thread.currentArgs.sha
  );
}
