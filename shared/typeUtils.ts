import { Review, ReviewState } from "./types";

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
