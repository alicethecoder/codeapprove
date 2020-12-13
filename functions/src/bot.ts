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
} from "../../shared/database";
import {
  Installation,
  Review,
  ReviewStatus,
  ThreadArgs,
  Thread,
} from "../../shared/types";

// TODO: How to get better types on context.payload
export function bot(app: Application) {
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

    // TODO: Implement
  });

  app.on("installation_repositories.removed", async (context) => {
    log.info("installation_repositories.removed");

    // TODO: Implement
  });

  app.on("installation.deleted", async (context) => {
    log.info("installation.deleted");

    // TODO: Implement
  });

  app.on("pull_request.opened", async (context) => {
    log.info("pull_request.opened");

    // TODO: Implement
    // TODO: Create a review
  });

  app.on("pull_request.closed", async (context) => {
    log.info("pull_request.closed");

    // If merged is false, the pull request was closed with unmerged commits.
    // If merged is true, the pull request was merged.
    const merged = context.payload.merged as boolean;

    // TODO: Implement
  });

  app.on("pull_request.synchronize", async (context) => {
    log.info("pull_request.synchronize");

    const owner = context.payload.repository.owner.login as string;
    const repo = context.payload.repository.name as string;
    const number = context.payload.number as number;

    await onPullRequestSynchronize(owner, repo, number);
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
  // TODO: What do we store in an org doc?
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

  // TODO: How expensive is this to do once per repo? Do I need to fan out this setup?
  const gh = await githubAuth.getAuthorizedGitHub(installation_id, repo_id);

  // 1) Create the installation document
  // TODO: Can there be more than one installation of a repo?
  log.info(`Creating installation for ${owner}/${repo}}`, installation);
  const installationRef = admin
    .firestore()
    .doc(installationPath({ owner, repo }));
  await installationRef.set(installation);

  // 2) For each open pull request on the repo, create a review document
  // TODO: This won't scale to repos with many many open PRs
  // TODO: Will this possibly obliterate previous installations? What about multiple
  //       users in an org?
  const pulls = await gh.getOpenPulls(owner, repo);
  for (const pull of pulls) {
    log.info(`Creating review for PR ${owner}/${repo}/pulls/${pull.number}`);

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
}

async function getAuthorizedRepoGithub(owner: string, repo: string) {
  // Get the installation ID
  const installationRef = admin
    .firestore()
    .doc(installationPath({ owner, repo }));

  const installationDoc = await installationRef.get();
  const installation = installationDoc.data() as Installation;

  // Get a GitHub instance authorized as the installation
  const gh = await githubAuth.getAuthorizedGitHub(
    installation.installation_id,
    installation.repo_id
  );

  return gh;
}

export async function onPullRequestSynchronize(
  owner: string,
  repo: string,
  number: number
) {
  log.info(`onPullRequestSynchronize: ${owner}/${repo}/${number}`);

  // Get a GitHub instance authorized as the installation
  const gh = await getAuthorizedRepoGithub(owner, repo);

  // Get the latest SHA
  const pr = await gh.getPullRequestMetadata(owner, repo, number);
  const headSha = pr.head.sha;

  // Update the review object with latest metadata
  const reviewRef = admin.firestore().doc(reviewPath({ owner, repo, number }));
  const review = (await reviewRef.get()).data() as Review;
  review.metadata.title = pr.title;
  review.metadata.base = pr.base;
  review.metadata.head = pr.head;
  review.metadata.updated_at = Date.parse(pr.updated_at);
  await reviewRef.update("metadata", review.metadata);

  // Load and update all threads
  const threadsRef = admin
    .firestore()
    .collection(threadsPath({ owner, repo, number }));
  const threadsSnap = await threadsRef.get();

  // TODO: What if the base branch changes? What if there was a force push?
  for (const thread of threadsSnap.docs) {
    const data = thread.data() as Thread;
    const { sha, file, line, lineContent } = data.currentArgs;

    if (sha !== headSha) {
      console.log(`Updating thread ${thread.ref.id} from ${sha}`);
      const newLine = await gh.translateLineNumberHeadMove(
        owner,
        repo,
        sha,
        headSha,
        file,
        line
      );

      // TODO: What if newLine === -1?
      // TODO: What about updated file name and line content?
      const newLineNumber = newLine.line;
      const newArgs: ThreadArgs = {
        sha: headSha,
        line: newLineNumber,
        lineContent: newLineNumber === -1 ? "" : lineContent,
        file: file,
      };

      await thread.ref.update("currentArgs", newArgs);
    } else {
      console.log(`Thread ${thread.ref.id} is up to date at ${sha}`);
    }
  }
}
