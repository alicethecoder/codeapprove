import {
  Review,
  ReviewState,
  ReviewStatus,
  ReviewMetadata,
  Thread,
} from "./types";
import * as config from "./config";

export function addReviewer(review: Review, login: string) {
  setAdd(review.state.reviewers, login);
}

export function removeReviewer(review: Review, login: string) {
  setRemove(review.state.reviewers, login);
}

export function addApprover(review: Review, login: string) {
  setAdd(review.state.approvers, login);
}

export function removeApprover(review: Review, login: string) {
  setRemove(review.state.approvers, login);
}

export function calculateReviewStatus(state: ReviewState): ReviewStatus {
  if (state.reviewers.length === 0) {
    return ReviewStatus.NEEDS_REVIEW;
  } else {
    if (state.approvers.length > 0) {
      if (state.unresolved > 0) {
        return ReviewStatus.NEEDS_RESOLUTION;
      } else {
        return ReviewStatus.APPROVED;
      }
    } else {
      return ReviewStatus.NEEDS_APPROVAL;
    }
  }
}

export function reviewMetadatasEqual(a: ReviewMetadata, b: ReviewMetadata) {
  return a.owner === b.owner && a.repo === b.repo && a.number === b.number;
}

export function reviewStatesEqual(a?: ReviewState, b?: ReviewState): boolean {
  if (!a || !b) {
    return a === b;
  }

  return (
    a.status === b.status &&
    a.closed === b.closed &&
    a.unresolved === b.unresolved &&
    arraysEqual(a.reviewers, b.reviewers) &&
    arraysEqual(a.approvers, b.approvers)
  );
}

export function statusClass(status: ReviewStatus) {
  switch (status) {
    case ReviewStatus.APPROVED:
      return {
        text: "text-green-400",
        border: "border-green-400",
      };
    case ReviewStatus.CLOSED_MERGED:
      return {
        text: "text-purple-300",
        border: "border-purple-300",
      };
    case ReviewStatus.CLOSED_UNMERGED:
      return {
        text: "text-red-400",
        border: "border-red-400",
      };
    case ReviewStatus.NEEDS_RESOLUTION:
    case ReviewStatus.NEEDS_APPROVAL:
    case ReviewStatus.NEEDS_REVIEW:
      return {
        text: "text-yellow-400",
        border: "border-yellow-400",
      };
  }
}

export function statusText(status: ReviewStatus): string {
  switch (status) {
    case ReviewStatus.APPROVED:
      return "Approved";
    case ReviewStatus.CLOSED_MERGED:
      return "Merged";
    case ReviewStatus.CLOSED_UNMERGED:
      return "Closed";
    case ReviewStatus.NEEDS_REVIEW:
      return "Needs Review";
    case ReviewStatus.NEEDS_RESOLUTION:
      return "Needs Resolution";
    case ReviewStatus.NEEDS_APPROVAL:
      return "Needs Approval";
  }
}

export function statusIconName(status: ReviewStatus): string {
  switch (status) {
    case ReviewStatus.APPROVED:
      return "check";
    case ReviewStatus.CLOSED_MERGED:
      return "code-branch";
    case ReviewStatus.CLOSED_UNMERGED:
      return "times";
    case ReviewStatus.NEEDS_RESOLUTION:
    case ReviewStatus.NEEDS_APPROVAL:
    case ReviewStatus.NEEDS_REVIEW:
      return "pause-circle";
  }
}

export function statusEmoji(status: ReviewStatus): string {
  switch (status) {
    case ReviewStatus.APPROVED:
      return "✔️";
    case ReviewStatus.CLOSED_MERGED:
      return "🚀";
    case ReviewStatus.CLOSED_UNMERGED:
      return "🗑️";
    case ReviewStatus.NEEDS_APPROVAL:
      return "⏳";
    case ReviewStatus.NEEDS_REVIEW:
      return "⏳";
    case ReviewStatus.NEEDS_RESOLUTION:
      return "❌";
  }
}

function describeStatus(status: ReviewStatus): string {
  return `${statusEmoji(status)} ${statusText(status)}`;
}

function threadsTable(threads: Thread[]): string {
  const nonDraft = threads.filter((t) => !t.draft);
  if (nonDraft.length === 0) {
    return "None";
  }

  const files: { [path: string]: { total: number; unresolved: number } } = {};
  for (const t of nonDraft) {
    const file = t.currentArgs.file;
    if (!files[file]) {
      files[file] = { total: 0, unresolved: 0 };
    }

    files[file].total++;
    if (!t.resolved) {
      files[file].unresolved++;
    }
  }

  const table = ["| File | # Comments | # Unresolved |", "|---|---|---|"];
  Object.keys(files).forEach((f) => {
    table.push(`| \`${f}\` | ${files[f].total} | ${files[f].unresolved} |`);
  });

  return table.join("\n");
}

export function reviewersTable(state: ReviewState) {
  if (state.reviewers.length === 0 && state.approvers.length === 0) {
    return "None";
  }

  const table = ["| User | Status |", "|---|---|"];
  for (const u of state.approvers) {
    table.push(`| @${u} | ${statusEmoji(ReviewStatus.APPROVED)} Approved |`);
  }
  for (const u of state.reviewers) {
    if (!state.approvers.includes(u)) {
      table.push(
        `| @${u} | ${statusEmoji(ReviewStatus.NEEDS_APPROVAL)} Pending |`
      );
    }
  }
  return table.join("\n");
}

export function getReviewComment(
  metadata: ReviewMetadata,
  state: ReviewState,
  threads: Thread[]
): string {
  // TODO(stop): Better comment for new review or closed reviews
  const url = `${config.baseUrl()}/pr/${metadata.owner}/${metadata.repo}/${
    metadata.number
  }`;
  return `#### Status
[${describeStatus(state.status)}](${url})

#### Reviewers
${reviewersTable(state)}

#### Comments
${threadsTable(threads)}`;
}

function setAdd<T>(arr: T[], item: T) {
  if (!arr.includes(item)) {
    arr.push(item);
  }
}

function setRemove<T>(arr: T[], item: T) {
  const ind = arr.indexOf(item);
  if (ind >= 0) {
    arr.splice(ind, 1);
  }
}

function arraysEqual<T>(a: T[], b: T[]): boolean {
  if (a.length !== b.length) {
    return false;
  }

  for (const item of a) {
    if (!b.includes(item)) {
      return false;
    }
  }

  return true;
}
