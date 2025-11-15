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
 * This function used to set `ctx.key`
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
