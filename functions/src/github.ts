import * as qs from "querystring";

import * as api from "./api";
import * as config from "./config";
import * as logger from "./logger";

const ax = api.getAxios();

export interface AccessTokenResponse {
  access_token: string;
  expires_in: string;
  refresh_token: string;
  refresh_token_expires_in: string;
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
  logger.info('github.exchangeCode');
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
  logger.info('github.exchangeRefreshToken');
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
