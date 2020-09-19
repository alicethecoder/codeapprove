import * as parseDiff from "parse-diff";

import { freezeArray } from "./freeze";
import { Side, SidePair } from "../model/review";

export interface FileMetadata {
  from: string;
  to: string;
  additions: number;
  deletions: number;
}

export interface RenderedChange {
  type: "add" | "del" | "normal";
  empty: boolean;
  number: number;
  marker: string;
  content: string;
}

export interface RenderedChangePair extends SidePair<RenderedChange> {
  commentsEnabled: boolean;
}

export interface ChangePair extends SidePair<parseDiff.Change | undefined> {}

export interface ChunkHeader {
  start: SidePair<number>;
  length: SidePair<number>;
}

export interface ChunkData {
  chunk: parseDiff.Chunk;
  pairs: RenderedChangePair[];
}

export interface PullRequestChange {
  file: parseDiff.File;
  metadata: FileMetadata;
  data: ChunkData[];
}

export const EMPTY_CHUNK: parseDiff.Chunk = {
  content: "",
  changes: [],
  oldStart: 0,
  oldLines: 1,
  newStart: 0,
  newLines: 1
};

export const EMPTY_RENDERED: RenderedChange = {
  type: "normal",
  empty: true,
  number: -1,
  marker: " ",
  content: ""
};

export function getFileMetadata(file: parseDiff.File): FileMetadata {
  return {
    from: file.from || "unknown",
    to: file.to || "unknown",
    additions: file.additions,
    deletions: file.deletions
  };
}

export function renderLoadedLineChange(
  line: number,
  content: string
): RenderedChange {
  return {
    type: "normal",
    empty: false,
    number: line,
    marker: "",
    content: content
  };
}

export function renderPairs(pairs: ChangePair[]): RenderedChangePair[] {
  const rps = pairs.map(p => {
    return {
      left: renderChange(p.left, "left"),
      right: renderChange(p.right, "right"),
      commentsEnabled: true
    };
  });

  return freezeArray(rps);
}

function zipArrays<T>(a: T[], b: T[]): T[] {
  const maxLen = Math.max(a.length, b.length);
  const res = new Array<T>();

  for (let i = 0; i < maxLen; i++) {
    if (i < a.length) {
      res.push(a[i]);
    }

    if (i < b.length) {
      res.push(b[i]);
    }
  }

  return res;
}

function sortChunkChanges(chunk: parseDiff.Chunk) {
  // First group the changes into "runs" of the same type
  const runs: parseDiff.Change[][] = [];
  let currRun: parseDiff.Change[] = [];
  for (const change of chunk.changes) {
    if (currRun.length === 0) {
      currRun.push(change);
    } else {
      if (change.type === currRun[0].type) {
        currRun.push(change);
      } else {
        runs.push(currRun);
        currRun = [change];
      }
    }
  }
  runs.push(currRun);

  // Now flatten things out but if there's a "del" run next to an "add"
  // run we zip them together.
  const res = new Array<parseDiff.Change>();
  let i = 0;
  while (i < runs.length) {
    if (i < runs.length - 1) {
      const a = runs[i];
      const b = runs[i + 1];

      if (a[0].type === "del" && b[0].type === "add") {
        res.push(...zipArrays(a, b));
        i += 2;
      } else {
        res.push(...a);
        i += 1;
      }
    } else {
      res.push(...runs[i]);
      i += 1;
    }
  }

  return res;
}

/**
 * Zip the list of changes from a chunk into an array of pairs ready to be diffed side-by-side.
 */
export function zipChangePairs(chunk: parseDiff.Chunk): ChangePair[] {
  const res: ChangePair[] = [];
  const changes = sortChunkChanges(chunk);

  let i = 0;
  while (i < changes.length) {
    const change = changes[i];

    // Del followed by add means the lines "match"
    if (i < changes.length - 1) {
      const next = changes[i + 1];
      if (change.type === "del" && next.type === "add") {
        res.push({
          left: change,
          right: next
        });

        // Extra increment
        i += 2;
        continue;
      }
    }

    if (change.type === "del") {
      res.push({ left: change, right: undefined });
    } else if (change.type === "add") {
      res.push({ left: undefined, right: change });
    } else {
      res.push({ left: change, right: change });
    }

    i++;
  }

  return res;
}

export function renderChange(
  change: parseDiff.Change | undefined,
  side: Side
): RenderedChange {
  // TODO: Drop this block and remove optional
  if (!change) {
    return EMPTY_RENDERED;
  }

  return {
    type: change.type,
    empty: false,
    number: changeLineNumber(change, side),
    content: changeContent(change),
    marker: changeLineMarker(change)
  };
}

export function changeLineMarker(change: parseDiff.Change): string {
  switch (change.type) {
    case "del":
      return "-";
    case "add":
      return "+";
    default:
      return " ";
  }
}

export function changeContent(change: parseDiff.Change): string {
  // Remove the + or the - from the start
  // TODO: Why is this the case for "normal" lines
  return change.content.substring(1);
}

export function changeLineNumber(change: parseDiff.Change, side: Side): number {
  switch (change.type) {
    case "add":
      return change.ln;
    case "del":
      return change.ln;
    case "normal":
      if (side == "left") {
        return change.ln1;
      } else {
        return change.ln2;
      }
  }
}
