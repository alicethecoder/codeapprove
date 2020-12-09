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
} from "../../shared/database";
import { Installation, Review, ReviewStatus } from "../../shared/types";

export function bot(app: Application) {
  app.on("installation.created", async (context) => {
    // Installation has been added
    log.info("installation.created");

    const installation_id = context.payload.installation.id;
    for (const repository of context.payload.repositories) {
      const [owner, repo]: string[] = repository.full_name.split("/");
      const repo_id = repository.id;

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
        log.info(
          `Creating review for PR ${owner}/${repo}/pulls/${pull.number}`
        );

        const review: Review = {
          metadata: {
            owner,
            repo: repo,
            number: pull.number,
            author: pull.user.login,
            base: {
              label: pull.base.label,
              sha: pull.base.sha,
            },
            head: {
              label: pull.head.label,
              sha: pull.head.sha,
            },
          },
          state: {
            status: ReviewStatus.NEEDS_REVIEW,
            reviewers: [],
            approvers: [],
          },
        };

        const reviewRef = admin
          .firestore()
          .doc(reviewPath({ owner, repo, number: pull.number }));
        await reviewRef.set(review);
      }
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
    // Installation has been deleted
    log.info("installation.deleted");

    // TODO: Implement
  });

  app.on("push", async (context) => {
    // A new commit has been pushed to a branch.
    log.info("push");

    // TODO: Implement
  });

  app.on("pull_request.opened", async (context) => {
    log.info("pull_request.opened");

    // TODO: Implement
    // TODO: Create a GitHub Review
  });
}
