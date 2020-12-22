import * as admin from "firebase-admin";
import * as qs from "querystring";
import { createAppAuth } from "@octokit/auth-app";

import * as api from "./api";
import * as config from "./config";
import * as logger from "./logger";
import { Github } from "../../shared/github";
import { installationPath } from "../../shared/database";
import { Installation } from "../../shared/types";

type AppAuth = ReturnType<typeof createAppAuth>;

const ax = api.getAxios();

const AUTH_CACHE: Record<number, AppAuth> = {};

export interface AccessTokenResponse {
  access_token: string;
  expires_in: string;
  refresh_token: string;
  refresh_token_expires_in: string;
}

export interface InstallationTokenResponse {
  token: string;
  expiresAt: Date;
}

function getAppAuth(installationId?: number): AppAuth {
  const id = installationId || -1;
  if (!AUTH_CACHE[id]) {
    const keyString = Buffer.from(
      config.github().private_key_encoded,
      "base64"
    ).toString("utf8");

    const appAuth = createAppAuth({
      id: config.github().app_id,
      privateKey: keyString,
      clientId: config.github().client_id,
      clientSecret: config.github().client_secret,
      installationId,
    });

    AUTH_CACHE[id] = appAuth;
  }

  return AUTH_CACHE[id];
}

export async function getInstallationToken(
  installationId: number,
  repositoryId: number
): Promise<InstallationTokenResponse> {
  const appAuth = getAppAuth(installationId);

  const tokenRes = await appAuth({
    type: "installation",
    permissions: {},
    repositoryIds: [repositoryId],
  });
  const token = tokenRes.token;
  const expiresAt = new Date(((tokenRes as unknown) as any).expiresAt);

  return {
    token,
    expiresAt,
  };
}

export async function getAuthorizedGitHub(
  installationId: number,
  repositoryId: number
): Promise<Github> {
  // Now get a token
  const token = await getInstallationToken(installationId, repositoryId);

  // Authorize a GitHub instance
  return new Github(
    {
      getToken: () => {
        return token.token;
      },
      getExpiry: () => {
        // TODO(polish): Deal with this possibility
        return Number.MAX_SAFE_INTEGER;
      },
      refreshAuth: async () => {
        // TODO(polish): Deal with this possibility
      },
    },
    config.github()
  );
}

export async function getAuthorizedRepoGithub(
  owner: string,
  repo: string
): Promise<Github> {
  // Get the installation ID
  const installationRef = admin
    .firestore()
    .doc(installationPath({ owner, repo }));

  const installationDoc = await installationRef.get();
  const installation = installationDoc.data() as Installation;

  // Get a GitHub instance authorized as the installation
  const gh = await getAuthorizedGitHub(
    installation.installation_id,
    installation.repo_id
  );

  return gh;
}

export async function getAppJwt(): Promise<string> {
  const appAuth = getAppAuth();
  const token = await appAuth({ type: "app" });
  return token.token;
}

function queryToTokenResponse(res: qs.ParsedUrlQuery): AccessTokenResponse {
  if (res.error) {
    throw new Error(`${res.error} - ${res.error_description}`);
  }

  return {
    access_token: res.access_token as string,
    expires_in: res.expires_in as string,
    refresh_token: res.refresh_token as string,
    refresh_token_expires_in: res.refresh_token_expires_in as string,
  };
}

export function getExpiryDate(expires_in_seconds: string): number {
  return new Date().getTime() + Number.parseInt(expires_in_seconds) * 1000;
}

export async function exchangeCode(code: string): Promise<AccessTokenResponse> {
  logger.info("github.exchangeCode");
  const tokenRes = await ax.post(
    `https://github.com/login/oauth/access_token?${qs.stringify({
      client_id: config.github().client_id,
      client_secret: config.github().client_secret,
      code,
    })}`
  );

  const res = qs.parse(tokenRes.data);
  return queryToTokenResponse(res);
}

export async function exchangeRefreshToken(
  refresh_token: string
): Promise<AccessTokenResponse> {
  logger.info("github.exchangeRefreshToken");
  const tokenRes = await ax.post(
    `https://github.com/login/oauth/access_token?${qs.stringify({
      client_id: config.github().client_id,
      client_secret: config.github().client_secret,
      grant_type: "refresh_token",
      refresh_token,
    })}`
  );

  const res = qs.parse(tokenRes.data);
  return queryToTokenResponse(res);
}
