import { Thread, ThreadArgs } from "../../../shared/types";

export type Side = "left" | "right";

export interface SidePair<T> {
  left: T;
  right: T;
}

export interface LangPair extends SidePair<string> {}

export interface ThreadPair extends SidePair<Thread | null> {}

export function threadMatch(thread: Thread, args: ThreadArgs): boolean {
  // TODO(stop): Consider originalArgs?
  return (
    args.file === thread.currentArgs.file &&
    args.line === thread.currentArgs.line &&
    args.sha === thread.currentArgs.sha
  );
}
