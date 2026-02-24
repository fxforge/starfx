import { type Operation, type Result, sleep } from "effection";
import { API_ACTION_PREFIX, put } from "../action.js";
import { parallel } from "./parallel.js";
import { safe } from "./safe.js";

export function superviseBackoff(attempt: number, max = 10): number {
  if (attempt > max) return -1;
  // 20ms, 40ms, 80ms, 160ms, 320ms, 640ms, 1280ms, 2560ms, 5120ms, 10240ms
  return 2 ** attempt * 10;
}

/**
 * supvervise will watch whatever {@link Operation} is provided
 * and it will automatically try to restart it when it exists.  By
 * default it uses a backoff pressure mechanism so if there is an
 * error simply calling the {@link Operation} then it will exponentially
 * wait longer until attempting to restart and eventually give up.
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
          meta: {
            message: `Exception caught, waiting ${waitFor}ms before restarting operation`,
          },
        });
        yield* sleep(waitFor);
      }

      attempt += 1;
      waitFor = backoff(attempt);
    }
  };
}

/**
 * keepAlive accepts a list of operations and calls them all with
 * {@link supervise}
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
