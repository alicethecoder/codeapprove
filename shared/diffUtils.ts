import * as parseDiff from "parse-diff";
import { ThreadArgs, Side } from "./types";

export interface LineTranslation {
  file: string;
  line: number;
}

/**
 * Determine how far a line has moved within a diff by counting lines above it
 * that have been added or deleted.
 */
export function calculateLineNudge(
  fileDiff: parseDiff.File,
  line: number
): number {
  // If the line in question is before the start of the diff, number is unchanged
  const firstLine = fileDiff.chunks[0].oldStart;
  if (line < firstLine) {
    return 0;
  }

  // Keep track of how many lines are added/deleted (net) above the line
  let nudge = 0;

  for (const chunk of fileDiff.chunks) {
    for (const change of chunk.changes) {
      // Loop until one of:
      // a) We find a normal block that's an exact match
      // b) We find a normal block that's after the line in question,
      //    letting us know that we passed it and we can apply the nudge
      switch (change.type) {
        case "normal":
          if (change.ln1 === line) {
            // The diff tells us the exact new line number, so the nudge is the
            // difference.
            return change.ln2 - change.ln1;
          } else if (change.ln1 > line) {
            return nudge;
          }
          break;
        case "add":
          nudge += 1;
          break;
        case "del":
          nudge -= 1;
          break;
      }
    }
  }

  // At this point the line is "off the end" of the diff so the nudge won't change
  return nudge;
}

/**
 * Translate a line between two commits, used as more commits are pushed
 * onto the HEAD of the review.
 */
export function translateLineNumber(
  diff: parseDiff.File[],
  args: ThreadArgs
): LineTranslation | undefined {
  const { file, line, sha } = args;

  // Find the file in the 'from' list
  const fileDiff = diff.find((f) => f.from === file);
  if (!fileDiff) {
    return undefined;
  }

  // Choose new file name (if it has changed)
  const newFileName = fileDiff.to || file;

  // Calculate of how many lines are added/deleted (net) above the line
  const nudge = calculateLineNudge(fileDiff, line);
  const newLineNumber = line + nudge;

  return {
    file: newFileName,
    line: newLineNumber,
  };
}

/**
 * Collect Change objects from a file diff that match a certain line number.
 */
export function collectLineChanges(
  fileDiff: parseDiff.File,
  line: number,
  side: Side
): parseDiff.Change[] {
  const changes = [];

  for (const chunk of fileDiff.chunks) {
    for (const change of chunk.changes) {
      if (change.type === "add" && change.ln === line) {
        changes.push(change);
      }

      if (change.type === "del" && change.ln === line) {
        changes.push(change);
      }

      if (change.type === "normal") {
        if (change.ln1 === line && side === "left") {
          changes.push(change);
        }

        if (change.ln2 === line && side === "right") {
          changes.push(change);
        }
      }
    }
  }

  return changes;
}
