export function userPath(opts: { id: string }) {
  return `/users/${opts.id}`;
}

export function orgPath(opts: { owner: string }) {
  return `/orgs/${opts.owner}`;
}

export function repoPath(opts: { owner: string; repo: string }) {
  return `${orgPath(opts)}/repos/${opts.repo}`;
}

export function installationPath(opts: { owner: string; repo: string }) {
  return `${repoPath(opts)}/installations/default`;
}

export function reviewsPath(opts: { owner: string; repo: string }) {
  return `${repoPath(opts)}/reviews`;
}

export function reviewPath(opts: {
  owner: string;
  repo: string;
  number: number;
}) {
  // TODO(stop): How bad is the hotspotting caused by using the number as the doc key?
  return `${repoPath(opts)}/reviews/${opts.number}`;
}

export function threadsPath(opts: {
  owner: string;
  repo: string;
  number: number;
}) {
  return `${reviewPath(opts)}/threads`;
}

export function commentsPath(opts: {
  owner: string;
  repo: string;
  number: number;
}) {
  return `${reviewPath(opts)}/comments`;
}
