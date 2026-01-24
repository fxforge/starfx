import {
  type Operation,
  type Signal,
  SignalQueueFactory,
  type Stream,
  call,
  createContext,
  createSignal,
  each,
  lift,
  spawn,
} from "effection";
import { type ActionPattern, matcher } from "./matcher.js";
import { createFilterQueue } from "./queue.js";
import type { Action, ActionWithPayload, AnyAction } from "./types.js";
import type { ActionFnWithPayload } from "./types.js";

/**
 * Shared action signal used by `put`, `useActions`, and related helpers.
 *
 * This context stores an Effection Signal that flows actions through the
 * runtime and is used by the action helpers to subscribe and emit actions.
 */
export const ActionContext = createContext(
  "starfx:action",
  createSignal<AnyAction, void>(),
);

/**
 * Subscribe to action events that match `pattern`.
 *
 * @remarks
 * Returns an Effection `Stream` that yields actions matching the provided pattern.
 * The stream will replay previously queued items for new subscribers.
 *
 * @param pattern - Pattern or action type to match against emitted actions.
 */
export function useActions(pattern: ActionPattern): Stream<AnyAction, void> {
  return {
    [Symbol.iterator]: function* () {
      const actions = yield* ActionContext.expect();
      const match = matcher(pattern);
      yield* SignalQueueFactory.set(() => createFilterQueue(match) as any);
      return yield* actions;
    },
  };
}

/**
 * Emit one or more actions into the provided signal.
 *
 * @param param0.signal - The Effection Signal to send actions through.
 * @param param0.action - An action or an array of actions.
 */
export function emit({
  signal,
  action,
}: {
  signal: Signal<AnyAction, void>;
  action: AnyAction | AnyAction[];
}) {
  if (Array.isArray(action)) {
    if (action.length === 0) {
      return;
    }
    action.map((a) => signal.send(a));
  } else {
    signal.send(action);
  }
}

/**
 * Put an action into the global action signal (convenience wrapper around {@link emit}).
 *
 * @param action - Action or actions to dispatch.
 */
export function* put(action: AnyAction | AnyAction[]) {
  const signal = yield* ActionContext.expect();
  return yield* lift(emit)({
    signal,
    action,
  });
}

/**
 * Take the next matching action from the action stream.
 *
 * @param pattern - Pattern to match actions against.
 * @returns The matching action or a sentinel if the stream closed.
 */
export function take<P>(
  pattern: ActionPattern,
): Operation<ActionWithPayload<P>>;
export function* take(pattern: ActionPattern): Operation<Action> {
  const actionStream = useActions(pattern);
  const subscription = yield* actionStream;
  const result = yield* subscription.next();
  if (result.done) {
    return {
      type: "Action stream closed before a matching action was received",
    };
  }
  return result.value;
}

/**
 * Spawn a handler for each matching action concurrently.
 */
export function* takeEvery<T>(
  pattern: ActionPattern,
  op: (action: AnyAction) => Operation<T>,
): Operation<void> {
  const fd = useActions(pattern);
  for (const action of yield* each(fd)) {
    yield* spawn(() => op(action));
    yield* each.next();
  }
}

/**
 * Spawn a handler for each matching action but cancel the previous one if a new
 * action arrives.
 */
export function* takeLatest<T>(
  pattern: ActionPattern,
  op: (action: AnyAction) => Operation<T>,
): Operation<void> {
  const fd = useActions(pattern);
  let lastTask;

  for (const action of yield* each(fd)) {
    if (lastTask) {
      yield* lastTask.halt();
    }
    lastTask = yield* spawn(() => op(action));
    yield* each.next();
  }
}

/**
 * Sequentially handle matching actions ensuring the handler finishes before
 * processing the next one.
 */
export function* takeLeading<T>(
  pattern: ActionPattern,
  op: (action: AnyAction) => Operation<T>,
): Operation<void> {
  while (true) {
    const action = yield* take(pattern);
    yield* call(() => op(action));
  }
}

/**
 * Wait until the provided predicate operation returns `true`.
 *
 * @param predicate - Operation returning a boolean.
 */
export function* waitFor(predicate: () => Operation<boolean>): Operation<void> {
  const init = yield* predicate();
  if (init) {
    return;
  }

  while (true) {
    yield* take("*");
    const result = yield* predicate();
    if (result) {
      return;
    }
  }
}

/**
 * Extract the deterministic id from an action or action-creator.
 */
export function getIdFromAction(
  action: ActionWithPayload<{ key: string }> | ActionFnWithPayload,
): string {
  return typeof action === "function" ? action.toString() : action.payload.key;
}

export const API_ACTION_PREFIX = "";

/**
 * Create an action creator function with optional payload.
 *
 * @param actionType - The action type string.
 */
export function createAction(actionType: string): () => Action;
export function createAction<P>(
  actionType: string,
): (p: P) => ActionWithPayload<P>;
export function createAction(actionType: string) {
  if (!actionType) {
    throw new Error("createAction requires non-empty string");
  }
  const fn = (payload?: unknown) => ({
    type: actionType,
    payload,
  });
  fn.toString = () => actionType;
  Object.defineProperty(fn, "_starfx", {
    value: true,
    enumerable: false,
    configurable: false,
    writable: false,
  });
  return fn;
}
