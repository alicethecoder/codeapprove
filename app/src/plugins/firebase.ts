import firebase from "firebase/app";
import "firebase/analytics";
import "firebase/auth";
import "firebase/firestore";
import "firebase/functions";
import "firebase/remote-config";

import { config } from "./config";

export function analytics(): firebase.analytics.Analytics {
  return app().analytics();
}

export function auth(): firebase.auth.Auth {
  return app().auth();
}

export function firestore(): firebase.firestore.Firestore {
  const firestore = app().firestore();
  if (process.env.NODE_ENV !== "production") {
    firestore.useEmulator("localhost", 8040);
  }
  return firestore;
}

export function functions(): firebase.functions.Functions {
  const functions = app().functions();
  if (process.env.NODE_ENV !== "production") {
    functions.useEmulator("localhost", 5001);
  }
  return functions;
}

export function remoteConfig(): firebase.remoteConfig.RemoteConfig {
  return app().remoteConfig();
}

function app(): firebase.app.App {
  if (firebase.apps.length === 0) {
    firebase.initializeApp(config.firebase);
  }

  return firebase.app();
}
