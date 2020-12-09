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

export function reviewStatesEqual(a?: ReviewState, b?: ReviewState): boolean {
  if (!a || !b) {
    return a === b;
  }

  return (
    a.status === b.status &&
    arraysEqual(a.reviewers, b.reviewers) &&
    arraysEqual(a.approvers, b.approvers)
  );
}

export function describeStatus(status: ReviewStatus): string {
  switch (status) {
    case ReviewStatus.APPROVED:
      return "Approved";
    case ReviewStatus.NEEDS_APPROVAL:
      return "Needs Approval";
    case ReviewStatus.NEEDS_RESOLUTION:
      return "Needs Resolution";
    case ReviewStatus.NEEDS_REVIEW:
      return "Needs Review";
  }
}

export function describeUsers(users: string[]) {
  return users.length === 0 ? "None" : users.map((x) => `@${x}`).join(", ");
}

export function getReviewComment(
  metadata: ReviewMetadata,
  state: ReviewState
): string {
  // TODO: Add some emoji, color, etc
  // TODO: Better comment for new review
  const url = `${config.baseUrl()}/pr/${metadata.owner}/${metadata.repo}/${
    metadata.number
  }`;
  return `[Status: ${describeStatus(state.status)}](${url})
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
