import * as admin from "firebase-admin";

import * as githubAuth from "./githubAuth";

import { userPath } from "../../shared/database";
import { User } from "../../shared/types";
import { docRef } from "./databaseUtil";

export async function saveUser(
  id: string,
  login: string,
  refresh_token: string,
  refresh_token_expires_in: string
) {
  const refresh_token_expires = githubAuth.getExpiryDate(
    refresh_token_expires_in
  );
  const user: User = {
    login,
    refresh_token,
    refresh_token_expires,
  };

  const userRef = docRef<User>(admin.firestore(), userPath({ id }));
  await userRef.set(user);
}

export async function getUser(id: string): Promise<User> {
  const ref = docRef<User>(admin.firestore(), userPath({ id }));
  const res = await ref.get();
  return res.data()!;
}
