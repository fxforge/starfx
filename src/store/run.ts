import type { Operation, Result, Scope, Task } from "effection";
import { parallel, safe } from "../fx/index.js";

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
