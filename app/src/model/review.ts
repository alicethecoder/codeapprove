export type Side = "left" | "right";

export interface SidePair<T> {
  left: T;
  right: T;
}

export interface ReviewMetadata {
  owner: string;
  repo: string;
  number: number;
}

// TODO:
// - Need information about what is up to date (comment shas, etc)
export interface Review {
  metadata: ReviewMetadata;
  reviewers: Record<string, boolean>;
  threads: Thread[];
  comments: Comment[];
}

// TODO:
// - Should not need "side" since the sha should determine that
// - Need two copies of all args - original and current
export interface ThreadArgs {
  file: string;
  sha: string;
  line: number;
}

export interface ThreadContentArgs {
  lineContent: string;
}

export interface Thread extends ThreadArgs, ThreadContentArgs {
  id: string;
  draft: boolean;
  resolved: boolean;
  pendingResolved: boolean;
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

export function threadMatch(thread: Thread, args: ThreadArgs): boolean {
  return (
    args.file === thread.file &&
    args.line === thread.line &&
    args.sha === thread.sha
  );
}
