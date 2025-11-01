import type { Operation, Result } from "effection";
import { getIdFromAction, take } from "../action.js";
import { parallel, safe } from "../fx/index.js";
import type { ThunkAction } from "../query/index.js";
import type { ActionFnWithPayload, AnyState, LoaderState } from "../types.js";
import { StoreContext } from "./context.js";
import type { LoaderOutput } from "./slice/loaders.js";
import type { FxStore, StoreUpdater, UpdaterCtx } from "./types.js";

export function* updateStore<S extends AnyState>(
  updater: StoreUpdater<S> | StoreUpdater<S>[],
): Operation<UpdaterCtx<S>> {
  const store = yield* StoreContext.expect();
  // had to cast the store since StoreContext has a generic store type
  const st = store as FxStore<S>;
  const ctx = yield* st.update(updater);
  return ctx;
}

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

export function* waitForLoaders<M extends AnyState>(
  loaders: LoaderOutput<M, AnyState>,
  actions: (ThunkAction | ActionFnWithPayload)[],
): Operation<Result<LoaderState<M>>[]> {
  const ops = actions.map((action) => () => waitForLoader(loaders, action));
  const group = yield* parallel<LoaderState<M>>(ops);
  return yield* group;
}

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
