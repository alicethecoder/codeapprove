import * as functions from "firebase-functions";
import { ServerGithubConfig } from "../../shared/types";

export function github(): ServerGithubConfig {
  const config = functions.config().github;
  return {
    app_id: Number.parseInt(config.app_id),
    ...config,
  };
}
