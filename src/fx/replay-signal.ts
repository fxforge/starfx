import type { Resolve, Subscription } from "effection";
import { action, resource } from "effection";

/**
 * Create a durable publish-subscribe signal with replay semantics.
 *
 * @typeParam T - Value type sent to subscribers.
 * @typeParam TClose - Optional close value type.
 * @returns A resource-style `subscribe` plus `send` and `close` helpers. New subscribers will receive previously sent items (replayed).
 */
export function createReplaySignal<T, TClose>() {
  const subscribers = new Set<Subscription<T, TClose>>();
  // single shared durable queue storage
  const queue = createDurableQueue<T, TClose>();

  // each subscriber gets its own iterator over the shared items by
  // calling `queue.subscribe()` which returns a Stream
  const subscribe = resource<Subscription<T, TClose>>(function* (provide) {
    const queued = queue.stream();
    subscribers.add(queued);

    try {
      yield* provide({ next: queued.next });
    } finally {
      subscribers.delete(queued);
    }
  });

  function send(value: T) {
    queue.add(value);
  }

  function close(value?: TClose) {
    queue.close(value);
  }

  return { ...subscribe, send, close };
}

function createDurableQueue<T, TClose = never>() {
  type Item = IteratorResult<T, TClose>;

  const items: Item[] = [];

  // a set of active subscribers; each subscription has its own iterator
  // and its own waiting notifier set
  const subscribers = new Set<{
    notify: Set<Resolve<Item>>;
  }>();

  function enqueue(item: Item) {
    items.push(item);
    for (const sub of subscribers) {
      if (sub.notify.size > 0) {
        const [resolve] = sub.notify;
        // use resolve from yield* action to notify waiting subscribers
        resolve(item);
      }
    }
  }

  function stream(): Subscription<T, TClose> {
    const iter = items[Symbol.iterator]();
    const notify = new Set<Resolve<Item>>();
    const sub = { notify };
    subscribers.add(sub);

    return {
      *next() {
        const item = iter.next().value;
        // item will be `undefined` when we've iterated to the end of the
        // current `items` array; in that case we wait for new items to be
        // enqueued and the resolve will be called with the new `Item`.
        if (item !== undefined) {
          return item;
        }
        return yield* action<Item>((resolve) => {
          notify.add(resolve);
          return () => notify.delete(resolve);
        });
      },
    };
  }

  return {
    add: (value: T) => enqueue({ done: false, value }),
    close: (value?: TClose) => enqueue({ done: true, value: value as TClose }),
    stream,
  };
}
