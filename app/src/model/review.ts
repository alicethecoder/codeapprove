export type Side = "left" | "right";

export interface ReviewMetadata {
  owner: string;
  repo: string;
  number: number;
}

export interface Review {
  metadata: ReviewMetadata;
  reviewers: Record<string, boolean>;
  threads: Thread[];
  comments: Comment[];
}

export interface ThreadArgs {
  file: string;
  side: Side;
  line: number;
}

export interface ThreadContentArgs {
  sha: string;
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

export interface LangPair {
  left: string;
  right: string;
}

export interface ThreadPair {
  left: Thread | null;
  right: Thread | null;
}

export function threadMatch(thread: Thread, args: ThreadArgs): boolean {
  return (
    args.file === thread.file &&
    args.line === thread.line &&
    args.side === thread.side
  );
}
