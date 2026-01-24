import { type Operation, type Result, sleep } from "effection";
import { API_ACTION_PREFIX, put } from "../action.js";
import { parallel } from "./parallel.js";
import { safe } from "./safe.js";

/**
 * Default exponential backoff used by {@link supervise}.
 *
 * @param attempt - Current attempt count (1-based).
 * @param max - Maximum attempts before giving up (default: 10).
 * @returns Milliseconds to wait before next attempt, or a negative value to stop.
 */
export function superviseBackoff(attempt: number, max = 10): number {
  if (attempt > max) return -1;
  // 20ms, 40ms, 80ms, 160ms, 320ms, 640ms, 1280ms, 2560ms, 5120ms, 10240ms
  return 2 ** attempt * 10;
}

/**
 * Create a supervised operation that will restart the provided operation when
 * it fails. The supervisor will apply a backoff strategy between attempts and
 * emit an action on failure.
 *
 * @param op - Operation factory to supervise.
 * @param backoff - Backoff function returning milliseconds to wait or <0 to stop.
 * @returns An operation factory that supervises `op`.
 */
export function supervise<T, TArgs extends unknown[] = []>(
  op: (...args: TArgs) => Operation<T>,
  backoff: (attemp: number) => number = superviseBackoff,
) {
  return function* (): Operation<void> {
    let attempt = 1;
    let waitFor = backoff(attempt);

    while (waitFor >= 0) {
      const res = yield* safe(op);

      if (res.ok) {
        attempt = 0;
      } else {
        yield* put({
          type: `${API_ACTION_PREFIX}supervise`,
          payload: res.error,
          meta: `Exception caught, waiting ${waitFor}ms before restarting operation`,
        });
        yield* sleep(waitFor);
      }

      attempt += 1;
      waitFor = backoff(attempt);
    }
  };
}

/**
 * Supervise (keep alive) a list of operations concurrently. Each operation
 * will be wrapped with {@link supervise} and executed in parallel.
 *
 * @param ops - Array of operation factories to supervise.
 * @param backoff - Optional custom backoff function.
 * @returns An array of supervision results wrapped in `Result`.
 */
export function* keepAlive<T, TArgs extends unknown[] = []>(
  ops: ((...args: TArgs) => Operation<T>)[],
  backoff?: (attempt: number) => number,
): Operation<Result<void>[]> {
  const supervised = ops.map((op) => supervise(op, backoff));
  const group = yield* parallel(supervised);
  const results = yield* group;
  return results;
}
