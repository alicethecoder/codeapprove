import * as admin from "firebase-admin";
import { DocumentPath, CollectionPath } from "../../shared/database";

export function docRef<T>(
  db: admin.firestore.Firestore,
  path: DocumentPath<T>
): admin.firestore.DocumentReference<T> {
  return db.doc(path).withConverter({
    toFirestore: (object: T) => {
      return object;
    },
    fromFirestore: (data) => {
      return data as T;
    },
  });
}

export function collectionRef<T>(
  db: admin.firestore.Firestore,
  path: CollectionPath<T>
): admin.firestore.CollectionReference<T> {
  return db.collection(path).withConverter({
    toFirestore: (object: T) => {
      return object;
    },
    fromFirestore: (data) => {
      return data as T;
    },
  });
}
