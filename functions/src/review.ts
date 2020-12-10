import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

import * as githubAuth from "./githubAuth";

import {
  Review,
  ReviewStatus,
  Thread,
  Installation,
  ReviewState,
} from "../../shared/types";
import { reviewStatesEqual, getReviewComment } from "../../shared/typeUtils";
import { installationPath, reviewPath } from "../../shared/database";

export const onReviewWrite = functions.firestore
  .document("orgs/{org}/repos/{repo}/reviews/{reviewId}")
  .onWrite(async (change, ctx) => {
    console.log(`onReviewWrite: ${JSON.stringify(ctx.params)}`);
    if (!change.after.exists) {
      console.log("Ignoring review deletion.");
      return;
    }

    const { org, repo } = ctx.params;

    const before = change.before.exists
      ? (change.before.data() as Review)
      : undefined;
    const after = change.after.data() as Review;

    // TODO: This function goes in a loop!
    // Check for a change in review state and recalculate status
    let newStatus: ReviewStatus | undefined = undefined;
    if (!reviewStatesEqual(before?.state, after?.state)) {
      await admin.firestore().runTransaction(async (t) => {
        const ref = change.after.ref;
        const reviewSnap = await t.get(ref);
        const review = reviewSnap.data() as Review;

        if (review.state.reviewers.length === 0) {
          newStatus = ReviewStatus.NEEDS_REVIEW;
        } else {
          if (review.state.approvers.length > 0) {
            if (review.state.unresolved > 0) {
              newStatus = ReviewStatus.NEEDS_RESOLUTION;
            } else {
              newStatus = ReviewStatus.APPROVED;
            }
          } else {
            newStatus = ReviewStatus.NEEDS_APPROVAL;
          }
        }

        console.log(`Setting review state.status to ${newStatus}`);
        await t.update(ref, "state.status", newStatus);
      });

      const installationRef = admin
        .firestore()
        .doc(installationPath({ owner: org, repo }));
      const installation = (await installationRef.get()).data() as Installation;
      const gh = await githubAuth.getAuthorizedGitHub(
        installation.installation_id,
        installation.repo_id
      );

      // Add a review and a comment
      if (newStatus && newStatus !== after.state.status) {
        const reviewEvent =
          newStatus === ReviewStatus.APPROVED ? "APPROVE" : "REQUEST_CHANGES";

        const state: ReviewState = {
          ...after.state,
          status: newStatus,
        };

        const body = getReviewComment(after.metadata, state);
        await gh.reviewPullRequest(
          org,
          repo,
          after.metadata.number,
          reviewEvent,
          body
        );
      }
    }
  });

export const onThreadWrite = functions.firestore
  .document("orgs/{org}/repos/{repo}/reviews/{reviewId}/threads/{threadId}")
  .onWrite(async (change, ctx) => {
    console.log(`onThreadWrite: ${JSON.stringify(ctx.params)}`);
    if (!change.after.exists) {
      console.log("Ignoring thread deletion.");
      return;
    }

    const { org, repo, reviewId, threadId } = ctx.params;

    const before = change.before.exists
      ? (change.before.data() as Thread)
      : undefined;
    const after = change.after.data() as Thread;

    if (before?.resolved !== after.resolved) {
      // Bump up/down unresolved count
      const diff = after.resolved ? -1 : 1;

      console.log(`Incrementing state.unresolved by ${diff}`);
      await admin
        .firestore()
        .doc(reviewPath({ owner: org, repo: repo, number: reviewId }))
        .update("state.unresolved", admin.firestore.FieldValue.increment(diff));
    }
  });
