import { OctokitResponse } from "@octokit/types";

type OctokitFunction<T, R> = (params: T) => Promise<OctokitResponse<R>>;

// TODO: Clear this sometimes!
const _CACHE: Record<string, Record<string, string>> = {};

export async function call<T, R>(
  name: string,
  fn: OctokitFunction<T, R>,
  args: T
): Promise<R> {
  const argsKey = JSON.stringify(args);

  if (!_CACHE[name]) {
    _CACHE[name] = {};
  }

  const cachedVal = _CACHE[name][argsKey];
  if (cachedVal) {
    console.log(`Cache hit for ${name}`);
    return JSON.parse(cachedVal) as R;
  }

  const res = await fn(args);
  const data = res.data;

  _CACHE[name][argsKey] = JSON.stringify(data);
  return data;
}
