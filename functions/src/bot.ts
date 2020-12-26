import * as admin from "firebase-admin";

import * as log from "./logger";
import * as githubAuth from "./githubAuth";
import { docRef, collectionRef } from "./databaseUtil";

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
  Org,
  Repo,
} from "../../shared/types";
import { ApplicationFunctionOptions } from "probot/lib/types";
import { calculateReviewStatus } from "../../shared/typeUtils";

export function bot(options: ApplicationFunctionOptions) {
  const app = options.app;
  const db = admin.firestore();

  app.on("installation.created", async (context) => {
    log.info("installation.created");

    const installation_id = context.payload.installation.id;
    for (const repository of context.payload.repositories) {
      const [owner, repo] = repository.full_name.split("/");
      const repo_id = repository.id;

      await onRepoInstalled(db, owner, repo, repo_id, installation_id);
    }
  });

  app.on("installation_repositories.added", async (context) => {
    log.info("installation_repositories.added");

    const installation_id = context.payload.installation.id;
    for (const repository of context.payload.repositories_added) {
      const [owner, repo] = repository.full_name.split("/");
      const repo_id = repository.id;

      await onRepoInstalled(db, owner, repo, repo_id, installation_id);
    }
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
    await createNewPullRequest(db, owner, repo, pull);
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

    const ref = docRef<Review>(db, reviewPath({ owner, repo, number }));
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
    const ref = docRef<Review>(db, reviewPath({ owner, repo, number }));
    await db.runTransaction(async (t) => {
      const review = (await t.get(ref)).data();
      if (!review) {
        return;
      }

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
    const reviewsRef = collectionRef<Review>(db, reviewsPath({ owner, repo }));
    const q = reviewsRef
      .where("metadata.base.label", "==", label)
      .where("state.status.closed", "==", false);

    const reviews = (await q.get()).docs.map((d) => d.data());
    for (const review of reviews) {
      log.info(
        `Updating ${owner}/${repo}/${review.metadata.number} after push to ${label}`
      );
      await updatePullRequest(db, owner, repo, review.metadata.number);
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

    await updatePullRequest(db, owner, repo, number);
  });
}

export async function onRepoInstalled(
  db: admin.firestore.Firestore,
  owner: string,
  repo: string,
  repo_id: number,
  installation_id: number
) {
  log.info(`onRepoInstalled: ${owner}/${repo}`);
  const orgRef = docRef<Org>(db, orgPath({ owner }));

  // Make sure the org exists
  const orgSnap = await orgRef.get();
  if (!orgSnap.exists) {
    log.info(`Creating org: ${owner}`);
    await orgRef.set({
      plan: "free",
    });
  }

  const repoRef = docRef<Repo>(db, repoPath({ owner, repo }));
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
  const installationRef = docRef<Installation>(
    db,
    installationPath({ owner, repo })
  );
  await installationRef.set(installation);

  // 2) For each open pull request on the repo, create a review document
  // TODO(stop): Fan out to scale to repos with many many open PRs
  // TODO(stop): Will this possibly obliterate previous installations? What about multiple
  //       users in an org?
  const pulls = await gh.getOpenPulls(owner, repo);
  for (const pull of pulls) {
    log.info(`Creating review for PR ${owner}/${repo}/pulls/${pull.number}`);
    await createNewPullRequest(db, owner, repo, pull);
  }
}

export async function createNewPullRequest(
  db: admin.firestore.Firestore,
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
      last_comment: 0,
    },
  };

  const reviewRef = docRef<Review>(
    db,
    reviewPath({ owner, repo, number: pull.number })
  );
  await reviewRef.set(review);
}

export async function updatePullRequest(
  db: admin.firestore.Firestore,
  owner: string,
  repo: string,
  number: number,
  opts: {
    force?: boolean;
  } = {}
) {
  log.info(`updatePullRequest: ${owner}/${repo}/${number}`);

  // Get a GitHub instance authorized as the installation
  const gh = await githubAuth.getAuthorizedRepoGithub(owner, repo);

  // Get the latest SHA
  const pr = await gh.getPullRequestMetadata(owner, repo, number);

  // Update the review object with latest metadata
  const reviewRef = docRef<Review>(db, reviewPath({ owner, repo, number }));
  const review = (await reviewRef.get()).data();
  if (!review) {
    throw new Error(`No such review: ${reviewRef.path}`);
  }

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
  const threadsRef = collectionRef<Thread>(
    db,
    threadsPath({ owner, repo, number })
  );
  const threadsSnap = await threadsRef.get();

  // TODO(stop): What if there was a force push?
  const headSha = pr.head.sha;
  const baseSha = pr.base.sha;

  for (const doc of threadsSnap.docs) {
    const thread = doc.data();

    // TODO(stop): What if the base branch changes?
    const baseChanged = thread.originalArgs.sha !== baseSha;
    const headChanged = thread.currentArgs.sha !== headSha;

    if (opts.force) {
      console.log("opts.force=true, updating all threads");
    }

    if (headChanged || opts.force) {
      log.info(
        `Updating thread ${thread.id} due to HEAD change ${thread.currentArgs.sha} --> ${headSha}`
      );
      const newLine = await gh.translateLineNumberHeadMove(
        owner,
        repo,
        thread.originalArgs.sha,
        headSha,
        thread.originalArgs.file,
        thread.originalArgs.line
      );

      // TODO(stop): What if newLine === -1? Mark as outdated?
      const newLineContent =
        newLine.line === -1
          ? ""
          : await gh.getContentLine(
              owner,
              repo,
              newLine.file,
              headSha,
              newLine.line
            );

      const newArgs: ThreadArgs = {
        sha: headSha,
        line: newLine.line,
        side: thread.currentArgs.side,
        lineContent: newLineContent,
        file: newLine.file,
      };

      log.info("Updating thread", {
        current: thread.currentArgs,
        new: newArgs,
      });
      await doc.ref.update("currentArgs", newArgs);
    } else {
      log.info(
        `Thread ${doc.ref.id} is up to date at ${thread.currentArgs.sha}`
      );
    }
  }
}
