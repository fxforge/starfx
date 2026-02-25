import type { Channel, Operation, Result, Task } from "effection";
import { createChannel, resource, spawn } from "effection";
import { safe } from "./safe.js";

export interface ParallelRet<T> extends Operation<Result<T>[]> {
  sequence: Channel<Result<T>, void>;
  immediate: Channel<Result<T>, void>;
}

/**
 * Run multiple operations in parallel with flexible result handling.
 *
 * @remarks
 * The `parallel` function makes it easier to coordinate multiple async
 * operations with different ways to receive completed tasks.
 *
 * All tasks are wrapped with {@link safe}, so they will never throw an
 * exception. Instead, all tasks return a {@link Result} that must be
 * evaluated to access the value or error.
 *
 * The returned resource provides three ways to consume results:
 * - **Await all**: `yield* task` waits for all operations to complete
 * - **Immediate**: `task.immediate` channel yields results as they complete
 * - **Sequence**: `task.sequence` channel yields results in original array order
 *
 * @typeParam T - The return type of operations.
 * @typeParam TArgs - Argument types for operations.
 * @param operations - Array of operation factories to run in parallel.
 * @returns A resource that provides multiple ways to access results.
 *
 * @see {@link safe} for the error-handling wrapper.
 * @see {@link each} from Effection for iterating over channels.
 *
 * @example Wait for all results
 * ```ts
 * import { parallel } from 'starfx';
 *
 * function* run() {
 *   const task = yield* parallel([fetchUsers, fetchPosts, fetchComments]);
 *
 *   // Wait for all tasks to complete
 *   const results = yield* task;
 *   // results[0] = fetchUsers result
 *   // results[1] = fetchPosts result
 *   // results[2] = fetchComments result
 *
 *   for (const result of results) {
 *     if (result.ok) {
 *       console.log('Success:', result.value);
 *     } else {
 *       console.error('Error:', result.error);
 *     }
 *   }
 * }
 * ```
 *
 * @example Process results as they complete
 * ```ts
 * import { each } from 'effection';
 *
 * function* run() {
 *   const task = yield* parallel([slowJob, fastJob]);
 *
 *   // Results arrive in completion order (fastest first)
 *   for (const result of yield* each(task.immediate)) {
 *     console.log('Completed:', result);
 *     yield* each.next();
 *   }
 * }
 * ```
 *
 * @example Process results in original order
 * ```ts
 * function* run() {
 *   const task = yield* parallel([job1, job2, job3]);
 *
 *   // Results arrive in array order regardless of completion time
 *   for (const result of yield* each(task.sequence)) {
 *     console.log('Result:', result);
 *     yield* each.next();
 *   }
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
