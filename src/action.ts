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

export const ActionContext = createContext(
  "starfx:action",
  createSignal<AnyAction, void>(),
);

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

export function* put(action: AnyAction | AnyAction[]) {
  const signal = yield* ActionContext.expect();
  return yield* lift(emit)({
    signal,
    action,
  });
}

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

export function* takeLeading<T>(
  pattern: ActionPattern,
  op: (action: AnyAction) => Operation<T>,
): Operation<void> {
  while (true) {
    const action = yield* take(pattern);
    yield* call(() => op(action));
  }
}

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

export function getIdFromAction(
  action: ActionWithPayload<{ key: string }> | ActionFnWithPayload<unknown>,
): string {
  return typeof action === "function" ? action.toString() : action.payload.key;
}

export const API_ACTION_PREFIX = "";

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
