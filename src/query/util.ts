import type { ApiRequest, RequiredApiRequest } from "./types.js";

export function* noop() {}
export const isFn = (fn?: any) => fn && typeof fn === "function";
export const isObject = (obj?: any) => typeof obj === "object" && obj !== null;

export const mergeHeaders = (
  cur?: HeadersInit,
  next?: HeadersInit,
): HeadersInit => {
  if (!cur && !next) return {};
  if (!cur && next) return next;
  if (cur && !next) return cur;
  return { ...cur, ...next };
};

export const mergeRequest = (
  cur?: ApiRequest | null,
  next?: ApiRequest | null,
): RequiredApiRequest => {
  const defaultReq = { url: "", method: "GET", headers: mergeHeaders() };
  if (!cur && !next) return { ...defaultReq, headers: mergeHeaders() };
  if (!cur && next) return { ...defaultReq, ...next };
  if (cur && !next) return { ...defaultReq, ...cur };
  return {
    ...defaultReq,
    ...cur,
    ...next,
    headers: mergeHeaders(cur?.headers, next?.headers),
  };
};
