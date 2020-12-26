import { Thread, ThreadArgs } from "../../../shared/types";

export interface SidePair<T> {
  left: T;
  right: T;
}

export interface LangPair extends SidePair<string> {}

export interface ThreadPair extends SidePair<Thread | null> {}

export function shouldDisplayThread(thread: Thread, args: ThreadArgs): boolean {
  // TODO(stop): need a "strict" mode for currentArgs only
  const keys: Array<keyof ThreadArgs> = ["file", "line", "side", "lineContent"];
  return (
    propsMatch(args, thread.currentArgs, keys) ||
    propsMatch(args, thread.originalArgs, keys)
  );
}

export function propsMatch<T>(a: T, b: T, keys: Array<keyof T>): boolean {
  for (const k of keys) {
    if (a[k] !== b[k]) {
      return false;
    }
  }

  return true;
}
