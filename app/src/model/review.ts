import { Thread, ThreadArgs } from "../../../shared/types";

export interface SidePair<T> {
  left: T;
  right: T;
}

export interface LangPair extends SidePair<string> {}

export interface ThreadPair extends SidePair<Thread | null> {}

export function shouldDisplayThread(thread: Thread, args: ThreadArgs): boolean {
  // TODO(stop): Consider originalArgs?
  return (
    args.file === thread.currentArgs.file &&
    args.line === thread.currentArgs.line &&
    args.side === thread.currentArgs.side
  );
}
