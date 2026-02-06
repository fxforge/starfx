import { type Operation, until, useAbortSignal } from "effection";

/**
 * Perform a fetch request using Effection's `until` and an abort signal.
 *
 * @param url - URL or Request to fetch.
 * @param opts - Optional `RequestInit` options.
 * @returns An Effection Operation resolving to the `Response`.
 */
export function* request(
  url: string | URL | Request,
  opts?: RequestInit,
): Operation<Response> {
  const signal = yield* useAbortSignal();
  const response = yield* until(fetch(url, { signal, ...opts }));
  return response;
}

/**
 * Helper to parse a `Response` JSON body as an Effection Operation.
 *
 * @param response - The fetch Response to parse.
 * @returns An Operation resolving to the parsed JSON value.
 */
export function* json(response: Response): Operation<unknown> {
  return yield* until(response.json());
}
