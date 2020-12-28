import { User, Org, Repo, Installation, Review, Thread } from "./types";

// TODO(polish): Why don't these type aliases actually do anything?
export type CollectionPath<T> = string;
export type DocumentPath<T> = string;

export function userPath(opts: { id: string }): DocumentPath<User> {
  return `/users/${opts.id}`;
}

export function orgPath(opts: { owner: string }): DocumentPath<Org> {
  return `/orgs/${opts.owner}`;
}

export function repoPath(opts: {
  owner: string;
  repo: string;
}): DocumentPath<Repo> {
  return `${orgPath(opts)}/repos/${opts.repo}`;
}

export function installationPath(opts: {
  owner: string;
  repo: string;
}): DocumentPath<Installation> {
  return `${repoPath(opts)}/installations/default`;
}

export function reviewsPath(opts: {
  owner: string;
  repo: string;
}): CollectionPath<Review> {
  return `${repoPath(opts)}/reviews`;
}

export function reviewPath(opts: {
  owner: string;
  repo: string;
  number: number;
}): DocumentPath<Review> {
  // TODO(stop): How bad is the hotspotting caused by using the number as the doc key?
  return `${repoPath(opts)}/reviews/${opts.number}`;
}

export function threadsPath(opts: {
  owner: string;
  repo: string;
  number: number;
}): CollectionPath<Thread> {
  return `${reviewPath(opts)}/threads`;
}

export function commentsPath(opts: {
  owner: string;
  repo: string;
  number: number;
}): CollectionPath<Comment> {
  return `${reviewPath(opts)}/comments`;
}
