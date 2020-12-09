import axios from "axios";
import * as logger from "./logger";
import * as axd from "axios-debug-log";
import * as debug from "debug";

// Default axios instance
const ax = axios.create();

// Configure axios-debug-log
axd.default({
  request: (debug, config) => {
    logger.debug(`Request: HTTP ${config.method}: "${config.url}"`);
    if (config.method !== "GET" && config.data) {
      logger.secret("Request Headers:", config.data);
      logger.secret("Request Body:", config.data);
    }
  },
  response: (debug, response) => {
    logger.debug(`Response: HTTP ${response.status}`);
    if (response.status >= 400) {
      logger.secret("Response Headers:", response.headers);
      logger.secret("Response Body:", response.data);
    }
  },
  error: (debug, error) => {
    logger.warn("Error:", error);
  },
});

// Add the logger to the instance
axd.addLogger(ax, debug.default("axios"));

export function getAxios() {
  return ax;
}
