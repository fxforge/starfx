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
 * @remarks
 * This context stores an Effection Signal that acts as the central event bus
 * for action dispatch. All actions flow through this signal, enabling the
 * pub/sub system that powers thunks and endpoints.
 *
 * The signal is automatically set up when you create a store with {@link createStore}.
 *
 * @see {@link put} for emitting actions.
 * @see {@link take} for receiving actions.
 * @see {@link useActions} for subscribing to action streams.
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
 * This is a low-level primitive. For most use cases, prefer {@link take},
 * {@link takeEvery}, {@link takeLatest}, or {@link takeLeading}.
 *
 * @param pattern - Pattern to match against emitted actions. Can be:
 *   - A string action type (e.g., `"FETCH_USERS"`)
 *   - An array of action types (e.g., `["LOGIN", "LOGOUT"]`)
 *   - A predicate function `(action) => boolean`
 *   - `"*"` to match all actions
 * @returns An Effection Stream that yields matching actions.
 *
 * @see {@link take} for taking a single action.
 * @see {@link takeEvery} for handling every matching action.
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
 * Put an action into the global action signal.
 *
 * @remarks
 * This is an Operation that must be yielded. It dispatches one or more
 * actions through the action signal, making them available to all subscribers
 * (thunks, endpoints, and custom watchers).
 *
 * This is the Operation-based equivalent of `store.dispatch()` for use inside
 * Effection scopes and middleware.
 *
 * @param action - A single action or array of actions to dispatch.
 *
 * @example Single action
 * ```ts
 * function* myThunk(ctx, next) {
 *   yield* put({ type: 'USER_CLICKED', payload: { id: '123' } });
 *   yield* next();
 * }
 * ```
 *
 * @example Multiple actions
 * ```ts
 * yield* put([
 *   { type: 'LOADING_START' },
 *   { type: 'FETCH_REQUESTED' },
 * ]);
 * ```
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
 * @remarks
 * Blocks until an action matching the pattern is dispatched, then returns it.
 * This is commonly used in supervisor loops to wait for specific events.
 *
 * @typeParam P - The expected payload type of the action.
 * @param pattern - Pattern to match against emitted actions. Can be:
 *   - A string action type (e.g., `"FETCH_USERS"`)
 *   - An array of action types (e.g., `["LOGIN", "LOGOUT"]`)
 *   - A predicate function `(action) => boolean`
 *   - `"*"` to match all actions
 * @returns The first action matching the pattern.
 *
 * @see {@link takeEvery} for handling every matching action.
 * @see {@link takeLatest} for cancelling previous handlers.
 * @see {@link takeLeading} for ignoring actions while busy.
 *
 * @example Basic usage
 * ```ts
 * function* watchLogin() {
 *   while (true) {
 *     const action = yield* take('LOGIN');
 *     console.log('User logged in:', action.payload);
 *   }
 * }
 * ```
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
 *
 * @remarks
 * This is the default supervisor strategy for thunks and endpoints. Each
 * dispatched action spawns a new concurrent task, allowing multiple instances
 * to run simultaneously.
 *
 * @typeParam T - The return type of the handler operation.
 * @param pattern - Pattern to match against actions.
 * @param op - Operation to run for each matching action.
 *
 * @see {@link takeLatest} for cancelling previous handlers.
 * @see {@link takeLeading} for ignoring actions while busy.
 *
 * @example
 * ```ts
 * function* watchFetch() {
 *   yield* takeEvery('FETCH_USERS', function* (action) {
 *     console.log('Fetching for:', action.payload);
 *     // Multiple fetches can run concurrently
 *   });
 * }
 * ```
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
 *
 * @remarks
 * Useful for search/autocomplete scenarios where only the most recent request
 * matters. When a new action is dispatched, the previous handler is halted.
 *
 * @typeParam T - The return type of the handler operation.
 * @param pattern - Pattern to match against actions.
 * @param op - Operation to run for each matching action.
 *
 * @see {@link takeEvery} for concurrent handlers.
 * @see {@link takeLeading} for ignoring actions while busy.
 *
 * @example
 * ```ts
 * const search = thunks.create('search', { supervisor: takeLatest });
 *
 * // Rapid dispatches cancel previous searches
 * store.dispatch(search('a'));   // cancelled
 * store.dispatch(search('ab'));  // cancelled
 * store.dispatch(search('abc')); // this one runs
 * ```
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
 * Sequentially handle matching actions, ensuring the handler finishes before
 * processing the next one.
 *
 * @remarks
 * Useful for preventing duplicate work or rate-limiting expensive
 * operations. Actions dispatched while a handler is running are ignored.
 *
 * @typeParam T - The return type of the handler operation.
 * @param pattern - Pattern to match against actions.
 * @param op - Operation to run for each matching action.
 *
 * @see {@link takeEvery} for concurrent handlers.
 * @see {@link takeLatest} for cancelling previous handlers.
 *
 * @example
 * ```ts
 * const submitForm = thunks.create('submit', { supervisor: takeLeading });
 *
 * // Only the first click is processed
 * store.dispatch(submitForm()); // runs
 * store.dispatch(submitForm()); // ignored (first still running)
 * store.dispatch(submitForm()); // ignored
 * ```
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
 * @remarks
 * Polls the predicate on each dispatched action until it returns `true`.
 * If the predicate is initially `true`, returns immediately.
 *
 * @param predicate - Operation returning a boolean.
 *
 * @example
 * ```ts
 * function* waitForUser(userId: string) {
 *   yield* waitFor(function* () {
 *     const user = yield* select(schema.users.selectById, { id: userId });
 *     return user.id !== '';
 *   });
 *   // User now exists in state
 * }
 * ```
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
 * @remarks
 * Creates a simple action creator that returns a Flux Standard Action (FSA).
 * The returned function has a `toString()` method that returns the action type,
 * useful for pattern matching.
 *
 * @param actionType - The action type string (must be non-empty).
 * @returns An action creator function.
 * @throws {Error} If `actionType` is empty.
 *
 * @example Without payload
 * ```ts
 * const increment = createAction('INCREMENT');
 * store.dispatch(increment()); // { type: 'INCREMENT' }
 * ```
 *
 * @example With typed payload
 * ```ts
 * const setUser = createAction<{ id: string; name: string }>('SET_USER');
 * store.dispatch(setUser({ id: '1', name: 'Alice' }));
 * // { type: 'SET_USER', payload: { id: '1', name: 'Alice' } }
 * ```
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
