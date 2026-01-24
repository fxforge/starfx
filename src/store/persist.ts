import { Err, Ok, type Operation, type Result } from "effection";
import type { AnyState, Next } from "../types.js";
import { select, updateStore } from "./fx.js";
import type { UpdaterCtx } from "./types.js";

/**
 * Loader id used internally by the persistence system to track rehydration status.
 */
export const PERSIST_LOADER_ID = "@@starfx/persist";

export interface PersistAdapter<S extends AnyState> {
  getItem(key: string): Operation<Result<Partial<S>>>;
  setItem(key: string, item: Partial<S>): Operation<Result<unknown>>;
  removeItem(key: string): Operation<Result<unknown>>;
}

export interface PersistProps<S extends AnyState> {
  adapter: PersistAdapter<S>;
  allowlist: (keyof S)[];
  key: string;
  reconciler: (original: S, rehydrated: Partial<S>) => S;
  rehydrate: () => Operation<Result<unknown>>;
  transform?: TransformFunctions<S>;
}
interface TransformFunctions<S extends AnyState> {
  in(s: Partial<S>): Partial<S>;
  out(s: Partial<S>): Partial<S>;
}

/**
 * Create a transform object for persistence that can alter the shape of the
 * state when saving or loading.
 *
 * @returns An object with `.in` and `.out` transformer functions.
 */
export function createTransform<S extends AnyState>() {
  const transformers: TransformFunctions<S> = {
    in: (currentState: Partial<S>): Partial<S> => currentState,
    out: (currentState: Partial<S>): Partial<S> => currentState,
  };

  const inTransformer = (state: Partial<S>): Partial<S> =>
    transformers.in(state);

  const outTransformer = (state: Partial<S>): Partial<S> =>
    transformers.out(state);

  return {
    in: inTransformer,
    out: outTransformer,
  };
}

export function createLocalStorageAdapter<
  S extends AnyState,
>(): PersistAdapter<S> {
  return {
    getItem: function* (key: string) {
      const storage = localStorage.getItem(key) || "{}";
      return Ok(JSON.parse(storage));
    },
    setItem: function* (key: string, s: Partial<S>) {
      const state = JSON.stringify(s);
      try {
        localStorage.setItem(key, state);
      } catch (err: any) {
        return Err(err);
      }
      return Ok(undefined);
    },
    removeItem: function* (key: string) {
      localStorage.removeItem(key);
      return Ok(undefined);
    },
  };
}

export function shallowReconciler<S extends AnyState>(
  original: S,
  persisted: Partial<S>,
): S {
  return { ...original, ...persisted };
}

/**
 * Create a persistor that knows how to rehydrate state from an adapter.
 *
 * @remarks
 * The persistor provides a `rehydrate` operation that reads persisted state,
 * applies an optional `transform.out`, and merges the result into the current
 * store state using the provided reconciler.
 *
 * @param options.adapter - PersistAdapter used to read/write storage.
 * @param options.key - Storage key for persisted data (default: "starfx").
 * @param options.reconciler - Function to merge original and rehydrated state.
 * @param options.allowlist - List of keys to persist (empty = persist entire state).
 * @param options.transform - Optional transformers for inbound/outbound shapes.
 * @returns Persistor properties including `rehydrate`.
 */
export function createPersistor<S extends AnyState>({
  adapter,
  key = "starfx",
  reconciler = shallowReconciler,
  allowlist = [],
  transform,
}: Pick<PersistProps<S>, "adapter"> &
  Partial<PersistProps<S>>): PersistProps<S> {
  function* rehydrate(): Operation<Result<undefined>> {
    const persistedState = yield* adapter.getItem(key);
    if (!persistedState.ok) {
      return Err(persistedState.error);
    }
    let stateFromStorage = persistedState.value as Partial<S>;

    if (transform) {
      try {
        stateFromStorage = transform.out(persistedState.value);
      } catch (err: any) {
        console.error("Persistor outbound transformer error:", err);
      }
    }

    const state = yield* select((s) => s);
    const nextState = reconciler(state as S, stateFromStorage);
    yield* updateStore<S>((state) => {
      Object.keys(nextState).forEach((key: keyof S) => {
        state[key] = nextState[key];
      });
    });

    return Ok(undefined);
  }

  return {
    key,
    adapter,
    allowlist,
    reconciler,
    rehydrate,
    transform,
  };
}

/**
 * Middleware that persists the store state after each update.
 *
 * @remarks
 * Applies an optional inbound transform and either persists the entire state
 * (when `allowlist` is empty) or only the listed keys.
 */
export function persistStoreMdw<S extends AnyState>({
  allowlist,
  adapter,
  key,
  transform,
}: PersistProps<S>) {
  return function* (_: UpdaterCtx<S>, next: Next) {
    yield* next();
    const state = yield* select((s: S) => s);

    let transformedState: Partial<S> = state;
    if (transform) {
      try {
        transformedState = transform.in(state);
      } catch (err: any) {
        console.error("Persistor inbound transformer error:", err);
      }
    }

    // empty allowlist list means save entire state
    if (allowlist.length === 0) {
      yield* adapter.setItem(key, transformedState);
      return;
    }

    const allowedState = allowlist.reduce<Partial<S>>((acc, key) => {
      if (key in transformedState) {
        acc[key] = transformedState[key] as S[keyof S];
      }
      return acc;
    }, {});

    yield* adapter.setItem(key, allowedState);
  };
}
