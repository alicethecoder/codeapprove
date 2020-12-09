import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import * as qs from "querystring";

import * as api from "./api";
import * as config from "./config";
import * as githubAuth from "./githubAuth";
import * as users from "./users";
import * as log from "./logger";

import { serverless, ProbotConfig } from "./probot-serverless-gcf";
import { bot } from "./bot";

import { Installation, Thread, ThreadArgs } from "../../shared/types";
import {
  installationPath,
  repoPath,
  reviewPath,
  threadsPath,
} from "../../shared/database";
import { baseUrl } from "../../shared/config";

const ax = api.getAxios();

admin.initializeApp();

function getProbotConfig(): ProbotConfig {
  return {
    id: config.github().app_id,
    webhookSecret: config.github().webhook_secret,
    privateKey: config.github().private_key_encoded,
  };
}

/**
 * Review state management
 */
export { onReviewWrite, onThreadWrite } from "./review";

/**
 * Probot app
 */
export const githubWebhook = functions.https.onRequest(
  serverless(getProbotConfig(), bot)
);

// TODO: Move this to be part of the probot
export const updateThreads = functions.https.onRequest(async (req, res) => {
  // TODO: Should not be hardcoded
  const owner = "hatboysam";
  const repo = "codeapprove";
  const number = 7;

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

  // Get the latest SHA
  const pr = await gh.getPullRequestMetadata(owner, repo, number);
  const headSha = pr.head.sha;

  const repoRef = admin.firestore().doc(repoPath({ owner, repo }));
  const reviewRef = admin.firestore().doc(reviewPath({ owner, repo, number }));
  const threadsRef = admin
    .firestore()
    .collection(threadsPath({ owner, repo, number }));

  const threadsSnap = await threadsRef.get();

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

  res.json({
    status: "ok",
  });
});

/**
 * Exchange a Firebase Auth token for a github access token
 */
export const getGithubToken = functions.https.onCall(async (data, ctx) => {
  if (!(ctx.auth && ctx.auth.uid)) {
    throw new Error("Unauthenticated");
  }

  const user = await users.getUser(ctx.auth.uid);
  log.info("uid", ctx.auth.uid);
  log.secret("user", user);

  const token = await githubAuth.exchangeRefreshToken(user.refresh_token);
  log.secret("token", token);

  // Save updated token to the database
  await users.saveUser(
    ctx.auth.uid,
    user.login,
    token.refresh_token,
    token.refresh_token_expires_in
  );

  return {
    access_token: token.access_token,
    access_token_expires: githubAuth.getExpiryDate(token.expires_in),
  };
});

/**
 * GitHub OAuth handler.
 */
export const oauth = functions.https.onRequest(async (request, response) => {
  const code = request.query.code as string;

  log.info("oauth", "Getting access tokens...");
  const {
    access_token,
    refresh_token,
    refresh_token_expires_in,
  } = await githubAuth.exchangeCode(code);

  log.secret("refresh_token", refresh_token);
  log.secret("refresh_token_expires_in", refresh_token_expires_in);

  const userRes = await ax.get(`https://api.github.com/user`, {
    headers: {
      Authorization: `token ${access_token}`,
    },
  });

  const { id, login, avatar_url } = userRes.data;
  log.info(`Github user: id=${id} login=${login}`);

  const userId = `${id}`;

  log.info("Firebase user:", userId);
  let userExists = false;
  try {
    await admin.auth().getUser(userId);
    userExists = true;
  } catch (e) {
    userExists = false;
  }

  if (userExists) {
    await admin.auth().updateUser(userId, {
      displayName: login,
      photoURL: avatar_url,
    });
  } else {
    await admin.auth().createUser({
      uid: userId,
      displayName: login,
      photoURL: avatar_url,
    });
  }

  const custom_token = await admin.auth().createCustomToken(userId, {
    login,
  });

  await users.saveUser(userId, login, refresh_token, refresh_token_expires_in);

  const res = {
    custom_token,
  };

  // TODO: There should probably be a special path here like /customauth;
  response.redirect(`${baseUrl()}/signin?${qs.stringify(res)}`);
});
