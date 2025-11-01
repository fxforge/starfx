import type { Channel, Operation, Result, Task } from "effection";
import { createChannel, resource, spawn } from "effection";
import { safe } from "./safe.js";

export interface ParallelRet<T> extends Operation<Result<T>[]> {
  sequence: Channel<Result<T>, void>;
  immediate: Channel<Result<T>, void>;
}

/**
 * The goal of `parallel` is to make it easier to cooridnate multiple async
 * operations in parallel, with different ways to receive completed tasks.
 *
 * All tasks are called with {@link safe} which means they will never
 * throw an exception.  Instead all tasks will return a Result object that
 * the end development must evaluate in order to grab the value.
 *
 * @example
 * ```ts
 * import { parallel } from "starfx";
 *
 * function* run() {
 *  const task = yield* parallel([job1, job2]);
 *  // wait for all tasks to complete before moving to next yield point
 *  const results = yield* task;
 *  // job1 = results[0];
 *  // job2 = results[1];
 * }
 * ```
 *
 * Instead of waiting for all tasks to complete, we can instead loop over
 * tasks as they arrive:
 *
 * @example
 * ```ts
 * function* run() {
 *  const task = yield* parallel([job1, job2]);
 *  for (const job of yield* each(task.immediate)) {
 *    // job2 completes first then it will be first in list
 *    console.log(job);
 *    yield* each.next();
 *  }
 * }
 * ```
 *
 * Or we can instead loop over tasks in order of the array provided to
 * parallel:
 *
 * @example
 * ```ts
 * function* run() {
 *  const task = yield* parallel([job1, job2]);
 *  for (const job of yield* each(task.sequence)) {
 *    // job1 then job2 will be returned regardless of when the jobs
 *    // complete
 *    console.log(job);
 *    yield* each.next();
 *  }
 * }
 * ```
 */
export function parallel<T, TArgs extends unknown[] = []>(
  operations: ((...args: TArgs) => Operation<T>)[],
): Operation<ParallelRet<T>> {
  const sequence = createChannel<Result<T>>();
  const immediate = createChannel<Result<T>>();
  const results: Result<T>[] = [];

  return resource<ParallelRet<T>>(function* (provide) {
    const task = yield* spawn(function* () {
      const tasks = [] as Task<Result<T>>[];
      for (const op of operations) {
        tasks.push(
          yield* spawn(function* () {
            const result = yield* safe(op);
            yield* immediate.send(result);
            return result;
          }),
        );
      }

      for (const tsk of tasks) {
        const res = yield* tsk;
        results.push(res);
        yield* sequence.send(res);
      }

      yield* sequence.close();
      yield* immediate.close();
    });

    yield* provide({
      sequence,
      immediate,
      *[Symbol.iterator]() {
        yield* task;
        return results;
      },
    });
  });
}
