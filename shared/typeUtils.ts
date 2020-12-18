import { Review, ReviewState, ReviewStatus, ReviewMetadata } from "./types";
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

function describeStatus(status: ReviewStatus): string {
  switch (status) {
    case ReviewStatus.APPROVED:
      return "🟢 Review Status: Approved";
    case ReviewStatus.CLOSED_MERGED:
      return "🚀 Review Status: Merged";
    case ReviewStatus.CLOSED_UNMERGED:
      return "🗑️ Review Status: Closed";
    case ReviewStatus.NEEDS_APPROVAL:
      return "🟡 Review Status: Needs Approval";
    case ReviewStatus.NEEDS_REVIEW:
      return "🟡 Review Status: Needs Review";
    case ReviewStatus.NEEDS_RESOLUTION:
      return "🔴 Review Status: Needs Resolution";
  }
}

function describeUsers(users: string[]) {
  return users.length === 0 ? "None" : users.map((x) => `@${x}`).join(", ");
}

export function getReviewComment(
  metadata: ReviewMetadata,
  state: ReviewState
): string {
  // TODO: Better comment for new review or closed reviews
  const url = `${config.baseUrl()}/pr/${metadata.owner}/${metadata.repo}/${
    metadata.number
  }`;
  return `[${describeStatus(state.status)}](${url})
  - Approved by: ${describeUsers(state.approvers)}
  - Reviewed by: ${describeUsers(state.reviewers)} 
  `;
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
