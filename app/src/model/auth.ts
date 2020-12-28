import firebase from "firebase";

export interface User {
  uid: string;
  email: string;
  username: string;
  photoURL: string;

  githubToken: string;
  githubExpiry: number;
}

export function createUser(
  u: firebase.User,
  githubToken: string,
  githubExpiry: number
): User {
  return {
    uid: u.uid,
    username: u.displayName!,
    email: u.email!,
    photoURL: u.photoURL!,
    githubToken,
    githubExpiry
  };
}
