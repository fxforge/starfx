import { action } from "effection";
import type { AnyState, Next } from "../types.js";
import type { UpdaterCtx } from "./types.js";

/**
 * Create middleware that batches store update notifications.
 *
 * @remarks
 * By default, every store update triggers immediate listener notifications.
 * This middleware defers notifications until the provided `queue` function
 * fires its callback, allowing multiple updates to be batched together.
 *
 * This is useful for integrating with React's batching mechanisms or other
 * frameworks that benefit from grouped updates.
 *
 * @typeParam S - Root store state type.
 * @param queue - Function that receives a `send` callback. Call `send()` when
 *   batched updates should notify listeners.
 * @returns A store middleware Operation.
 *
 * @example With setTimeout (debounce-like)
 * ```ts
 * const batchMdw = createBatchMdw((send) => {
 *   setTimeout(send, 16); // ~60fps
 * });
 * ```
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
