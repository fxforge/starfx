import { action } from "effection";
import type { AnyState, Next } from "../types.js";
import type { UpdaterCtx } from "./types.js";

/**
 * Middleware that batches store updates by deferring notifications until the
 * supplied `queue` fires its send callback.
 *
 * @typeParam S - Root store state type.
 * @param queue - Function that receives a `send` callback to be invoked when batched updates should notify.
 * @returns A store middleware generator function.
 */
export function createBatchMdw<S extends AnyState>(
  queue: (send: () => void) => void,
) {
  let notifying = false;
  return function* batchMdw(_: UpdaterCtx<S>, next: Next) {
    if (!notifying) {
      notifying = true;
      yield* action<void>((resolve) => {
        queue(() => {
          notifying = false;
          resolve();
        });
        return () => {};
      });
      yield* next();
    }
  };
}
