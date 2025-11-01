import { action } from "effection";
import type { AnyState, Next } from "../types.js";
import type { UpdaterCtx } from "./types.js";

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
