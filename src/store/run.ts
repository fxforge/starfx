import type { Operation, Result, Scope, Task } from "effection";
import { parallel, safe } from "../fx/index.js";

/**
 * Bind a `run` helper to an Effection `Scope`.
 *
 * @remarks
 * The returned `run` function accepts either a single operation factory or an
 * array of operation factories and returns an Effection `Task` that resolves
 * to the operation result(s). When given an array, operations are executed in parallel.
 *
 * @param scope - The Effection scope used to run tasks.
 * @returns A `run` function bound to the provided `scope`.
 */
export function createRun(scope: Scope) {
  function run<T>(op: (() => Operation<T>)[]): Task<Result<T>[]>;
  function run<T>(op: () => Operation<T>): Task<Result<T>>;
  function run<T>(
    op: (() => Operation<T>) | (() => Operation<T>)[],
  ): Task<Result<T> | Result<T>[]> {
    if (Array.isArray(op)) {
      return scope.run(function* (): Operation<Result<T>[]> {
        const group = yield* parallel(op);
        const result = yield* group;
        return result;
      });
    }
    return scope.run(() => safe(op));
  }

  return run;
}
