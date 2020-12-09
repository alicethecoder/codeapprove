import * as functions from "firebase-functions";

const DEV_PROJECT_ID = "codeapprove-dev";
const PROD_PROJECT_ID = "codeapprove-prod";

export interface GithubConfig {
  app_id: number;
  client_id: string;
  client_secret: string;
  webhook_secret: string;
  private_key_encoded: string;
}

export function github(): GithubConfig {
  const config = functions.config().github;
  return {
    app_id: Number.parseInt(config.app_id),
    ...config,
  };
}
