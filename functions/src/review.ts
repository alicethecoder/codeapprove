import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

import { Review, ReviewStatus, Thread } from "../../shared/types";
import { reviewStatesEqual } from "../../shared/typeUtils";

export const onReviewWrite = functions.firestore
  .document("reviews/{reviewId}")
  .onWrite(async (change, ctx) => {
    console.log(`onReviewWrite: ${ctx.params.reviewId}`);
    if (!change.after.exists) {
      console.log("Ignoring review deletion.");
      return;
    }

    const before = change.before.exists
      ? (change.before.data() as Review)
      : undefined;
    const after = change.after.data() as Review;

    // TODO: This function goes in a loop!
    // Check for a change in review state and recalculate status
    if (!reviewStatesEqual(before?.state, after?.state)) {
      await admin.firestore().runTransaction(async (t) => {
        const ref = change.after.ref;
        const reviewSnap = await t.get(ref);
        const review = reviewSnap.data() as Review;

        let status = review.state.status;
        if (review.state.reviewers.length === 0) {
          status = ReviewStatus.NEEDS_REVIEW;
        } else {
          if (review.state.approvers.length > 0) {
            // TODO: Get this from the document!
            const countUnresolved = 0;
            if (countUnresolved > 0) {
              status = ReviewStatus.NEEDS_RESOLUTION;
            } else {
              status = ReviewStatus.APPROVED;
            }
          } else {
            status = ReviewStatus.NEEDS_APPROVAL;
          }
        }

        console.log(`Setting review state.status to ${status}`);
        await t.update(ref, "state.status", status);
      });
    }
  });

export const onThreadWrite = functions.firestore
  .document("reviews/{reviewId}/threads/{threadId}")
  .onWrite(async (change, ctx) => {
    console.log(
      `onThreadWrite: ${ctx.params.reviewId}/threads/${ctx.params.threadId}`
    );
    if (!change.after.exists) {
      console.log("Ignoring thread deletion.");
      return;
    }

    const before = change.before.exists
      ? (change.before.data() as Thread)
      : undefined;
    const after = change.after.data() as Thread;

    if (before?.resolved !== after.resolved) {
      // Bump up/down unresolved count
      const diff = after.resolved ? -1 : 1;
      await change.after.ref.parent?.parent?.update(
        "state.unresolved",
        admin.firestore.FieldValue.increment(diff)
      );
    }
  });
