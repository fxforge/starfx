import { createQueue } from "effection";

/**
 * Create a queue that only accepts values matching `predicate`.
 *
 * @typeParam T - The item type.
 * @typeParam TClose - The optional close value type.
 * @param predicate - Predicate called for each value before enqueueing.
 * @returns A queue with the same API as Effection's `createQueue`, but filtered.
 */
export function createFilterQueue<T, TClose>(predicate: (v: T) => boolean) {
  const queue = createQueue<T, TClose>();

  return {
    ...queue,
    add(value: T) {
      if (predicate(value)) {
        queue.add(value);
      }
    },
  };
}
