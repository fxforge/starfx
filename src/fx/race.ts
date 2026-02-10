import type { Operation, Task } from "effection";
import { resource, spawn, withResolvers } from "effection";

interface OpMap<T = unknown, TArgs extends unknown[] = []> {
  [key: string]: (...args: TArgs) => Operation<T>;
}

/**
 * Race multiple named operations and return the winner's result.
 *
 * @remarks
 * Each operation in `opMap` starts concurrently. When one operation
 * completes first, all others are halted and the function resolves
 * with a result map containing the winner's value.
 *
 * This is useful for implementing timeouts, cancellation patterns,
 * or "first response wins" scenarios.
 *
 * @typeParam T - The return type of operations.
 * @param opMap - Map of named operation factories.
 * @returns An operation resolving to the result map with the winning value.
 *
 * @example Timeout pattern
 * ```ts
 * import { raceMap, sleep } from 'starfx';
 *
 * function* fetchWithTimeout() {
 *   const result = yield* raceMap({
 *     data: () => fetchData(),
 *     timeout: () => sleep(5000),
 *   });
 *
 *   if (result.data) {
 *     return result.data;
 *   }
 *   throw new Error('Request timed out');
 * }
 * ```
 *
 * @example First response wins
 * ```ts
 * function* fetchFromMultipleSources() {
 *   const result = yield* raceMap({
 *     primary: () => fetchFromPrimary(),
 *     fallback: () => fetchFromFallback(),
 *   });
 *
 *   // Use whichever responded first
 *   return result.primary ?? result.fallback;
 * }
 * ```
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
