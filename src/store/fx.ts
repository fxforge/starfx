import type { Operation, Result } from "effection";
import { getIdFromAction, take } from "../action.js";
import { parallel, safe } from "../fx/index.js";
import type { ThunkAction } from "../query/index.js";
import type { ActionFnWithPayload, AnyState, LoaderState } from "../types.js";
import { expectStore } from "./context.js";
import type { LoaderOutput } from "./slice/loaders.js";
import type {
  FxMap,
  SliceFromSchema,
  StoreUpdater,
  UpdaterCtx,
} from "./types.js";

/**
 * Updates the store using the default schema's update method.
 * For multiple schemas, use `store.schemas[name].update()` directly.
 */
export function* updateStore<S extends AnyState>(
  updater: StoreUpdater<S> | StoreUpdater<S>[],
): Operation<UpdaterCtx<S>> {
  const store = yield* expectStore<FxMap>();
  const ctx = yield* store.schema.update(
    updater as
      | StoreUpdater<SliceFromSchema<FxMap>>
      | StoreUpdater<SliceFromSchema<FxMap>>[],
  );
  return ctx as UpdaterCtx<S>;
}

export function* select<S, Args extends unknown[], R>(
  selectorFn: (s: S, ...args: Args) => R,
  ...args: Args
): Operation<R> {
  const store = yield* expectStore<FxMap>();
  return selectorFn(store.getState() as S, ...args);
}

export function* waitForLoader(
  loaders: LoaderOutput,
  action: ThunkAction | ActionFnWithPayload<unknown>,
): Operation<LoaderState> {
  const id = getIdFromAction(action);
  const selector = (s: Parameters<typeof loaders.selectById>[0]) =>
    loaders.selectById(s, { id });

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

export function* waitForLoaders(
  loaders: LoaderOutput,
  actions: (ThunkAction | ActionFnWithPayload<unknown>)[],
): Operation<Result<LoaderState>[]> {
  const ops = actions.map((action) => () => waitForLoader(loaders, action));
  const group = yield* parallel<LoaderState>(ops);
  return yield* group;
}

export function createTracker<T>(loader: LoaderOutput) {
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
