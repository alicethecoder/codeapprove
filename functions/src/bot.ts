import { Application } from "probot";
import * as admin from "firebase-admin";

import * as config from "./config";
import * as log from "./logger";
import * as githubAuth from "./githubAuth";

import {
  orgPath,
  repoPath,
  installationPath,
  reviewPath,
  threadsPath,
  reviewsPath,
} from "../../shared/database";
import {
  Installation,
  Review,
  ReviewStatus,
  ThreadArgs,
  Thread,
  ReviewMetadataSource,
} from "../../shared/types";
import { ApplicationFunctionOptions } from "probot/lib/types";
import { calculateReviewStatus } from "../../shared/typeUtils";

export function bot(options: ApplicationFunctionOptions) {
  const app = options.app;

  app.on("installation.created", async (context) => {
    log.info("installation.created");

    const installation_id = context.payload.installation.id;
    for (const repository of context.payload.repositories) {
      const [owner, repo]: string[] = repository.full_name.split("/");
      const repo_id = repository.id;

      await onRepoInstalled(owner, repo, repo_id, installation_id);
    }
  });

  app.on("installation_repositories.added", async (context) => {
    log.info("installation_repositories.added");

    // TODO(stop): Implement
  });

  app.on("installation_repositories.removed", async (context) => {
    log.info("installation_repositories.removed");

    // TODO(stop): Implement
  });

  app.on("installation.deleted", async (context) => {
    log.info("installation.deleted");

    // TODO(stop): Implement
  });

  app.on("pull_request.opened", async (context) => {
    log.info("pull_request.opened");

    const owner = context.payload.repository.owner.login;
    const repo = context.payload.repository.name;
    const pull = context.payload.pull_request;

    // TODO(stop): Add the bot as a reviewer!
    await createNewPullRequest(owner, repo, pull);
  });

  app.on("pull_request.closed", async (context) => {
    log.info("pull_request.closed");

    const owner = context.payload.repository.owner.login;
    const repo = context.payload.repository.name;
    const number = context.payload.pull_request.number;

    // If merged is false, the pull request was closed with unmerged commits.
    // If merged is true, the pull request was merged.
    const merged = context.payload.pull_request.merged;
    const newStatus = merged
      ? ReviewStatus.CLOSED_MERGED
      : ReviewStatus.CLOSED_UNMERGED;

    const ref = admin.firestore().doc(reviewPath({ owner, repo, number }));
    const updates = {
      "state.closed": true,
      "state.status": newStatus,
    };
    await ref.update(updates);
  });

  app.on("pull_request.reopened", async (context) => {
    log.info("pull_request.reopened");

    const owner = context.payload.repository.owner.login;
    const repo = context.payload.repository.name;
    const number = context.payload.pull_request.number;

    // When re-opened we need to change the status back to one of the
    // non-closed options.
    const ref = admin.firestore().doc(reviewPath({ owner, repo, number }));
    await admin.firestore().runTransaction(async (t) => {
      const review = (await t.get(ref)).data() as Review;

      const newStatus = calculateReviewStatus(review.state);
      const updates = {
        "state.closed": false,
        "state.status": newStatus,
      };
      await t.update(ref, updates);
    });
  });

  app.on("push", async (context) => {
    log.info("push");

    const ref = context.payload.ref;
    const branchPrefix = "refs/heads/";

    if (!ref.startsWith(branchPrefix)) {
      log.info(`push: ignoring non-branch ref ${ref}`);
      return;
    }

    const owner = context.payload.repository.owner.login;
    const repo = context.payload.repository.name;
    const branch = ref.substring(branchPrefix.length);

    log.info(`push: ${owner}/${repo} @ ${branch}`);

    // Find all open reviews with this as the BASE, pushes to HEAD
    // are handled by the pull_request.synchronize event
    const label = `${owner}:${branch}`;
    const q = admin
      .firestore()
      .collection(reviewsPath({ owner, repo }))
      .where("metadata.base.label", "==", label)
      .where("state.status.closed", "==", false);

    const reviews = (await q.get()).docs.map((d) => d.data() as Review);
    for (const review of reviews) {
      log.info(
        `Updating ${owner}/${repo}/${review.metadata.number} after push to ${label}`
      );
      await updatePullRequest(owner, repo, review.metadata.number);
    }
  });

  app.on("pull_request.synchronize", async (context) => {
    // This event happens when the HEAD of a pull request is updated, but
    // not the BASE:
    // https://github.community/t/what-is-a-pull-request-synchronize-event/14784/2
    //
    // The reason to watch this event rather than just 'push' is because this lets
    // you observe pushes for PRs from forks.
    log.info("pull_request.synchronize");

    const owner = context.payload.repository.owner.login;
    const repo = context.payload.repository.name;
    const number = context.payload.number;

    await updatePullRequest(owner, repo, number);
  });
}

export async function onRepoInstalled(
  owner: string,
  repo: string,
  repo_id: number,
  installation_id: number
) {
  log.info(`onRepoInstalled: ${owner}/${repo}`);
  const orgRef = admin.firestore().doc(orgPath({ owner }));

  // Make sure the org exists
  const orgSnap = await orgRef.get();
  if (!orgSnap.exists) {
    log.info(`Creating org: ${owner}`);
    await orgRef.set({
      plan: "free",
    });
  }

  const repoRef = admin.firestore().doc(repoPath({ owner, repo }));

  const repoSnap = await repoRef.get();
  if (!repoSnap.exists) {
    log.info(`Creating repo: ${repo}`);
    await repoRef.set({
      owner,
      name: repo,
    });
  }

  const installation: Installation = {
    installation_id,
    repo_id,
  };

  // TODO(polish): How expensive is this to do once per repo? Do I need to fan out this setup?
  const gh = await githubAuth.getAuthorizedGitHub(installation_id, repo_id);

  // 1) Create the installation document
  // TODO(stop): Can there be more than one installation of a repo?
  log.info(`Creating installation for ${owner}/${repo}}`, installation);
  const installationRef = admin
    .firestore()
    .doc(installationPath({ owner, repo }));
  await installationRef.set(installation);

  // 2) For each open pull request on the repo, create a review document
  // TODO(stop): Fan out to scale to repos with many many open PRs
  // TODO(stop): Will this possibly obliterate previous installations? What about multiple
  //       users in an org?
  const pulls = await gh.getOpenPulls(owner, repo);
  for (const pull of pulls) {
    log.info(`Creating review for PR ${owner}/${repo}/pulls/${pull.number}`);
    await createNewPullRequest(owner, repo, pull);
  }
}

export async function createNewPullRequest(
  owner: string,
  repo: string,
  pull: ReviewMetadataSource
) {
  const review: Review = {
    metadata: {
      owner,
      repo: repo,
      number: pull.number,
      author: pull.user.login,
      title: pull.title,
      base: {
        label: pull.base.label,
        sha: pull.base.sha,
      },
      head: {
        label: pull.head.label,
        sha: pull.head.sha,
      },
      updated_at: new Date(pull.updated_at).getTime(),
    },
    state: {
      status: ReviewStatus.NEEDS_REVIEW,
      closed: false,
      reviewers: [],
      approvers: [],
      unresolved: 0,
    },
  };

  const reviewRef = admin
    .firestore()
    .doc(reviewPath({ owner, repo, number: pull.number }));
  await reviewRef.set(review);
}

export async function updatePullRequest(
  owner: string,
  repo: string,
  number: number
) {
  log.info(`updatePullRequest: ${owner}/${repo}/${number}`);

  // Get a GitHub instance authorized as the installation
  const gh = await githubAuth.getAuthorizedRepoGithub(owner, repo);

  // Get the latest SHA
  const pr = await gh.getPullRequestMetadata(owner, repo, number);
  const headSha = pr.head.sha;

  // Update the review object with latest metadata
  const reviewRef = admin.firestore().doc(reviewPath({ owner, repo, number }));
  const review = (await reviewRef.get()).data() as Review;
  review.metadata.title = pr.title;
  review.metadata.base = {
    sha: pr.base.sha,
    label: pr.base.label,
  };
  review.metadata.head = {
    sha: pr.head.sha,
    label: pr.head.label,
  };
  review.metadata.updated_at = Date.parse(pr.updated_at);
  await reviewRef.update("metadata", review.metadata);

  // Load and update all threads
  const threadsRef = admin
    .firestore()
    .collection(threadsPath({ owner, repo, number }));
  const threadsSnap = await threadsRef.get();

  // TODO(stop): What if the base branch changes? What if there was a force push?
  for (const thread of threadsSnap.docs) {
    const data = thread.data() as Thread;
    const { sha, file, line, lineContent } = data.currentArgs;

    if (sha !== headSha) {
      log.info(`Updating thread ${thread.ref.id} from ${sha}`);
      const newLine = await gh.translateLineNumberHeadMove(
        owner,
        repo,
        sha,
        headSha,
        file,
        line
      );

      // TODO(stop): What if newLine === -1?
      // TODO(stop): What about updated file name and line content?
      const newLineNumber = newLine.line;
      const newArgs: ThreadArgs = {
        sha: headSha,
        line: newLineNumber,
        lineContent: newLineNumber === -1 ? "" : lineContent,
        file: file,
      };

      await thread.ref.update("currentArgs", newArgs);
    } else {
      log.info(`Thread ${thread.ref.id} is up to date at ${sha}`);
    }
  }
}
