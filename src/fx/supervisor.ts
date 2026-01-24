import { type Operation, type Result, sleep } from "effection";
import { API_ACTION_PREFIX, put } from "../action.js";
import { parallel } from "./parallel.js";
import { safe } from "./safe.js";

/**
 * Default exponential backoff strategy used by {@link supervise}.
 *
 * @remarks
 * Uses exponential backoff with base 2: 20ms, 40ms, 80ms, ... up to ~10 seconds.
 * Returns a negative value when max attempts are exceeded, signaling to stop.
 *
 * @param attempt - Current attempt count (1-based).
 * @param max - Maximum attempts before giving up (default: 10).
 * @returns Milliseconds to wait before next attempt, or negative to stop.
 *
 * @example Custom max attempts
 * ```ts
 * const backoff = (attempt: number) => superviseBackoff(attempt, 5);
 * const supervised = supervise(myOperation, backoff);
 * ```
 */
export function superviseBackoff(attempt: number, max = 10): number {
  if (attempt > max) return -1;
  // 20ms, 40ms, 80ms, 160ms, 320ms, 640ms, 1280ms, 2560ms, 5120ms, 10240ms
  return 2 ** attempt * 10;
}

/**
 * Create a supervised operation that restarts on failure with backoff.
 *
 * @remarks
 * Supervisor tasks monitor operations and manage their health. When the
 * supervised operation fails, the supervisor waits according to the backoff
 * strategy before restarting it. This pattern is inspired by Erlang's
 * supervisor trees.
 *
 * On failure, an action is emitted with the error details, useful for
 * debugging and monitoring.
 *
 * @typeParam T - The return type of the operation.
 * @typeParam TArgs - Argument types for the operation.
 * @param op - Operation factory to supervise.
 * @param backoff - Backoff function returning milliseconds to wait, or negative to stop.
 *   Defaults to {@link superviseBackoff}.
 * @returns An operation factory that supervises the original operation.
 *
 * @see {@link superviseBackoff} for the default backoff strategy.
 * @see {@link keepAlive} for supervising multiple operations.
 * @see {@link https://www.erlang.org/doc/design_principles/des_princ | Erlang supervisors}
 *
 * @example Basic supervision
 * ```ts
 * import { supervise } from 'starfx';
 *
 * function* unstableTask() {
 *   // We want this to run forever, restarting on failure
 *   // but it may fail intermittently
 * }
 *
 * const supervised = supervise(unstableTask);
 * yield* supervised(); // Automatically restarts on failure
 * ```
 *
 * @example Custom backoff
 * ```ts
 * // Linear backoff: 1s, 2s, 3s, ...
 * const linearBackoff = (attempt: number) =>
 *   attempt > 5 ? -1 : attempt * 1000;
 *
 * const supervised = supervise(myTask, linearBackoff);
 * ```
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
 * Supervise multiple operations concurrently, keeping them all alive.
 *
 * @remarks
 * Wraps each operation with {@link supervise} and runs them in parallel.
 * Useful for starting multiple background services that should all stay
 * running (e.g., WebSocket connections, polling tasks, etc.).
 *
 * @typeParam T - The return type of operations.
 * @typeParam TArgs - Argument types for operations.
 * @param ops - Array of operation factories to supervise.
 * @param backoff - Optional custom backoff function.
 * @returns An array of supervision results wrapped in {@link Result}.
 *
 * @see {@link supervise} for individual operation supervision.
 * @see {@link parallel} for non-supervised parallel execution.
 *
 * @example Keep multiple services alive
 * ```ts
 * import { keepAlive } from 'starfx';
 *
 * function* startApp() {
 *   yield* keepAlive([
 *     websocketConnection,
 *     heartbeatPing,
 *     backgroundSync,
 *   ]);
 * }
 * ```
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
