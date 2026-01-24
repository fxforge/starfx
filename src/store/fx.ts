import type { Operation, Result } from "effection";
import { getIdFromAction, take } from "../action.js";
import { parallel, safe } from "../fx/index.js";
import type { ThunkAction } from "../query/index.js";
import type { ActionFnWithPayload, AnyState, LoaderState } from "../types.js";
import { StoreContext } from "./context.js";
import type { LoaderOutput } from "./slice/loaders.js";
import type { FxStore, StoreUpdater, UpdaterCtx } from "./types.js";

/**
 * Apply a store updater within the current store context.
 *
 * @typeParam S - Root state shape.
 * @param updater - Updater function or array of updaters to apply.
 * @returns The update context produced by the store.
 *
 * @example
 * ```ts
 * // apply a simple raw updater
 * yield* updateStore([(s: any) => { s.counter = (s.counter || 0) + 1 }]);
 *
 * // apply a schema-provided updater helper
 * yield* updateStore([schema.users.add({ [user.id]: user })]);
 * ```
 */
export function* updateStore<S extends AnyState>(
  updater: StoreUpdater<S> | StoreUpdater<S>[],
): Operation<UpdaterCtx<S>> {
  const store = yield* StoreContext.expect();
  // had to cast the store since StoreContext has a generic store type
  const st = store as FxStore<S>;
  const ctx = yield* st.update(updater);
  return ctx;
}

/**
 * Evaluate a selector against the current store state.
 *
 * @param selectorFn - Selector function to evaluate.
 * @param p - Optional parameter passed to the selector.
 *
 * @example
 * ```ts
 * // return an array of users
 * const users = yield* select(schema.users.selectTableAsList);
 * // return a single user by id
 * const user = yield* select(schema.users.selectById, { id: '1' });
 * ```
 */
export function select<S, R>(selectorFn: (s: S) => R): Operation<R>;
export function select<S, R, P>(
  selectorFn: (s: S, p: P) => R,
  p: P,
): Operation<R>;
export function* select<S, R, P>(
  selectorFn: (s: S, p?: P) => R,
  p?: P,
): Operation<R> {
  const store = yield* StoreContext.expect();
  return selectorFn(store.getState() as S, p);
}

/**
 * Wait for a loader associated with `action` to enter a terminal state
 * (`success` or `error`).
 *
 * @param loaders - The loader slice instance.
 * @param action - The action or action-creator which identifies the loader.
 * @returns The final loader state.
 *
 * @example
 * ```ts
 * // wait until the loader for `fetchUsers()` completes
 * const loader = yield* waitForLoader(schema.loaders, fetchUsers());
 * if (loader.isSuccess) { // handle success }
 * ```
 */
export function* waitForLoader<M extends AnyState>(
  loaders: LoaderOutput<M, AnyState>,
  action: ThunkAction | ActionFnWithPayload,
): Operation<LoaderState<M>> {
  const id = getIdFromAction(action);
  const selector = (s: AnyState) => loaders.selectById(s, { id });

  // check for done state on init
  let loader = yield* select(selector);
  if (loader.isSuccess || loader.isError) {
    return loader;
  }

  while (true) {
    yield* take("*");
    loader = yield* select(selector);
    if (loader.isSuccess || loader.isError) {
      return loader;
    }
  }
}

/**
 * Wait for multiple loaders associated with `actions` to reach a terminal state.
 *
 * @example
 * ```ts
 * const results = yield* waitForLoaders(schema.loaders, [fetchUser(), fetchPosts()]);
 * for (const res of results) {
 *   if (res.ok) {
 *     // res.value is a LoaderState
 *   }
 * }
 * ```
 */
export function* waitForLoaders<M extends AnyState>(
  loaders: LoaderOutput<M, AnyState>,
  actions: (ThunkAction | ActionFnWithPayload)[],
): Operation<Result<LoaderState<M>>[]> {
  const ops = actions.map((action) => () => waitForLoader(loaders, action));
  const group = yield* parallel<LoaderState<M>>(ops);
  return yield* group;
}

/**
 * Produce a helper that wraps an operation with loader start/success/error updates.
 *
 * @param loader - Loader slice instance used to mark start/success/error.
 *
 * @example
 * ```ts
 * const track = createTracker(schema.loaders);
 * const trackedOp = track('my-id')(function* () {
 *   return yield* safe(() => someAsyncOp());
 * });
 * const result = yield* trackedOp;
 * if (result.ok) { // result.value is the operation Result }
 * ```
 */
export function createTracker<T, M extends Record<string, unknown>>(
  loader: LoaderOutput<M, AnyState>,
) {
  return (id: string) => {
    return function* (
      op: () => Operation<Result<T>>,
    ): Operation<Result<Result<T>>> {
      yield* updateStore(loader.start({ id }));
      const result = yield* safe(op);
      if (result.ok) {
        yield* updateStore(loader.success({ id }));
      } else {
        yield* updateStore(
          loader.error({
            id,
            message: result.error.message,
          }),
        );
      }
      return result;
    };
  };
}
