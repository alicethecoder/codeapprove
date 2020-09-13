import * as functions from "firebase-functions";

const isEmulator = process.env.FUNCTIONS_EMULATOR === "true";

export function debug(label: string, value?: any) {
  if (isEmulator) {
    functions.logger.log(label, value);
  }
}

export function info(label: string, value?: any) {
  functions.logger.info(label, value);
}

export function warn(label: string, value?: any) {
  functions.logger.warn(label, value);
}

export function secret(label: string, value?: any) {
  if (isEmulator) {
    functions.logger.log(label, value);
  } else {
    functions.logger.log(label, "********");
  }
}
