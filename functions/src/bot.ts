import { Application } from "probot";

import * as config from "./config";
import * as log from "./logger";

export function bot(app: Application) {
  app.on("push", async (context) => {
    // A new commit has been pushed to a branch.
    log.debug("push", context);

    // TODO: Implement
  });

  app.on("pull_request", async (context) => {
    log.debug("pull_request", context);

    // TODO: Implement
  });

  app.on("check_suite.requested", async (context) => {
    // A new check suite has been created. A check suite is a collection
    // of check runs for a commit. GitHub sends check_suite.requested
    // to all GitHub apps that are installed on each commit.
    //
    // A check run is an individual test that runs as part of a check suite.
    log.debug("check_suite.requested", context);

    const owner = context.repo().owner;
    const repo = context.repo().repo;
    const number = context.issue().number;

    const checkCreateRes = await context.github.checks.create({
      name: "CodeApprove",
      owner,
      repo,
      head_sha: context.payload.check_suite.head_sha,
      status: "in_progress",
      details_url: `${config.baseUrl()}/pr/${owner}/${repo}/${number}`,
    });

    // TODO: Store this id somewhere for updating
    log.debug(
      `Created check run ${checkCreateRes.data.id} in suite ${checkCreateRes.data.check_suite.id}`
    );
  });
}
