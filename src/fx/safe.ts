import type { Operation, Result } from "effection";
import { Err, Ok, call } from "effection";

/**
 * The goal of `safe` is to wrap Operations to prevent them from raising
 * and error.  The result of `safe` is always a {@link Result} type.
 *
 * @example
 * ```ts
 * import { safe } from "starfx";
 *
 * function* run() {
 *  const results = yield* safe(fetch("api.com"));
 *  if (result.ok) {
 *    console.log(result.value);
 *  } else {
 *    console.error(result.error);
 *  }
 * }
 * ```
 */
function isError(error: unknown): error is Error {
  return error instanceof Error;
}

export function* safe<T, TArgs extends unknown[] = []>(
  operator: (...args: TArgs) => Operation<T>,
): Operation<Result<T>> {
  try {
    const value = yield* call(operator);
    return Ok(value);
  } catch (error) {
    return Err(isError(error) ? error : new Error(String(error)));
  }
}
