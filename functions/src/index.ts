import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import * as qs from "querystring";

import * as api from "./api";
import * as config from "./config";
import * as github from "./github";
import * as users from "./users";
import * as log from "./logger";

import { serverless, ProbotConfig } from "./probot-serverless-gcf";
import { bot } from "./bot";

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
 * Probot app
 */
export const githubWebhook = functions.https.onRequest(
  serverless(getProbotConfig(), bot)
);

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

  const token = await github.exchangeRefreshToken(user.refresh_token);
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
    access_token_expires: github.getExpiryDate(token.expires_in),
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
  } = await github.exchangeCode(code);

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

  // TODO: There should probably be a special path here like /customauth
  const baseUrl = config.baseUrl();
  response.redirect(`${baseUrl}/signin?${qs.stringify(res)}`);
});
