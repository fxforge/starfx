import { isObject } from "./util.js";

const deepSortObject = (opts?: any) => {
  if (!isObject(opts)) return opts;
  return Object.keys(opts)
    .sort()
    .reduce<Record<string, unknown>>((res, key) => {
      res[`${key}`] = opts[key];
      if (opts[key] && isObject(opts[key])) {
        res[`${key}`] = deepSortObject(opts[key]);
      }
      return res;
    }, {});
};

function padStart(hash: string, len: number) {
  let hsh = hash;
  while (hsh.length < len) {
    hsh = `0${hsh}`;
  }
  return hsh;
}

// https://gist.github.com/iperelivskiy/4110988
const tinySimpleHash = (s: string) => {
  let h = 9;
  for (let i = 0; i < s.length; ) {
    h = Math.imul(h ^ s.charCodeAt(i++), 9 ** 9);
  }
  return h ^ (h >>> 9);
};

/**
 * Create a deterministic key for an action based on its `name` and `payload`.
 *
 * @remarks
 * The payload is deep-sorted and hashed so that semantically equivalent
 * payload objects produce the same key string. This key is used to identify
 * loader and cache entries in the store.
 *
 * @param name - Action endpoint name (e.g. '/users/:id').
 * @param payload - Optional payload object used to generate a stable hash.
 * @returns A string key in the form `name|hash` when payload is provided, otherwise `name`.
 */
export const createKey = (name: string, payload?: any) => {
  const normJsonString =
    typeof payload !== "undefined"
      ? JSON.stringify(deepSortObject(payload))
      : "";
  const hash = normJsonString
    ? padStart(tinySimpleHash(normJsonString).toString(16), 8)
    : "";
  return hash ? `${name}|${hash}` : name;
};
