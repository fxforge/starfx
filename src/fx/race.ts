import type { Operation, Task } from "effection";
import { resource, spawn, withResolvers } from "effection";

interface OpMap<T = unknown, TArgs extends unknown[] = []> {
  [key: string]: (...args: TArgs) => Operation<T>;
}

/**
 * Race multiple operations and return the result map of the first-completed task.
 *
 * @remarks
 * Each operation in `opMap` is started concurrently. When one operation
 * completes, the others are halted and the function resolves with an object
 * mapping keys to their respective completed values.
 *
 * @param opMap - Map of named operation factories.
 * @returns An operation that resolves to the result map of the winner task.
 */
export function raceMap<T>(opMap: OpMap): Operation<{
  [K in keyof OpMap<T>]: OpMap[K] extends (...args: any[]) => any
    ? ReturnType<OpMap[K]>
    : OpMap[K];
}> {
  return resource(function* Race(provide) {
    const keys = Object.keys(opMap);
    const taskMap: { [key: string]: Task<unknown> } = {};
    const resultMap: { [key: keyof OpMap]: ReturnType<OpMap[keyof OpMap]> } =
      {};

    function* start() {
      const resolvers = withResolvers();

      for (let i = 0; i < keys.length; i += 1) {
        const key = keys[i];
        yield* spawn(function* () {
          const task = yield* spawn(opMap[key]);
          taskMap[key] = task;
          (resultMap[key] as any) = yield* task;
          resolvers.resolve(task);
        });
      }

      return yield* resolvers.operation;
    }

    const winner = yield* start();

    for (let i = 0; i < keys.length; i += 1) {
      const key = keys[i];
      const task = taskMap[key];
      if (task === winner) {
        continue;
      }

      yield* spawn(() => task.halt());
    }

    yield* provide(resultMap);
  });
}
