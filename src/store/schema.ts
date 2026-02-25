import { lift } from "effection";
import { type Draft, enablePatches, produceWithPatches } from "immer";
import { API_ACTION_PREFIX, ActionContext, emit } from "../action.js";
import { type BaseMiddleware, compose } from "../compose.js";
import { type AnyState, ListenersContext, type Next } from "../index.js";
import { StoreUpdateContext, expectStore } from "./context.js";
import { slice } from "./slice/index.js";
import type {
  FactoryInitial,
  FactoryReturn,
  FxMap,
  FxSchema,
  FxStore,
  SliceFromSchema,
  StoreUpdater,
  UpdaterCtx,
} from "./types.js";

const defaultSchema = <O>(): O =>
  ({ cache: slice.table(), loaders: slice.loaders() }) as O;

/**
 * Builds the slice map and initial state from a slices configuration.
 * This is a helper for creating custom schema implementations.
 */
export function buildSlices<O extends FxMap>(
  slices: O,
): {
  db: { [key in keyof O]: FactoryReturn<O[key]> };
  initialState: { [key in keyof O]: FactoryInitial<O[key]> };
} {
  const db = {} as { [key in keyof O]: FactoryReturn<O[key]> };
  for (const key of Object.keys(slices) as Array<keyof O>) {
    const factory = slices[key];
    if (!factory) continue; // defensive - O may allow optional entries
    const f = factory as (n: string) => FactoryReturn<O[typeof key]>;
    db[key] = f(String(key));
  }

  const initialState = {} as { [key in keyof O]: FactoryInitial<O[key]> };
  for (const key of Object.keys(db) as Array<keyof O>) {
    initialState[key] = db[key].initialState as FactoryInitial<O[typeof key]>;
  }

  return { db, initialState };
}

export interface CreateSchemaWithUpdaterOptions<S extends AnyState> {
  /**
   * Unique name for this schema. Used to access the schema from the store.
   * @default "default"
   */
  name?: string;
  middleware?: BaseMiddleware<UpdaterCtx<S>>[];
  /**
   * Factory function that creates the update middleware.
   * This is where you implement your state update logic (e.g., immer, plain objects, etc.)
   */
  updateMdw: BaseMiddleware<UpdaterCtx<S>>;
}

function* logMdw<O extends FxMap>(
  ctx: UpdaterCtx<SliceFromSchema<O>>,
  next: Next,
) {
  const signal = yield* ActionContext.expect();
  const action = {
    type: `${API_ACTION_PREFIX}store`,
    payload: ctx,
  };

  yield* lift(emit)({ signal, action });
  yield* next();
}

function* notifyChannelMdw<O extends FxMap>(
  _: UpdaterCtx<SliceFromSchema<O>>,
  next: Next,
) {
  const chan = yield* StoreUpdateContext.expect();
  yield* chan.send();
  yield* next();
}

function* notifyListenersMdw<O extends FxMap>(
  _: UpdaterCtx<SliceFromSchema<O>>,
  next: Next,
) {
  const listeners = yield* ListenersContext.expect();
  listeners.forEach((f) => f());
  yield* next();
}

/**
 * Core schema factory that takes a custom update middleware creator.
 * Use this to create schema implementations with different state update mechanisms.
 *
 * @example
 * ```ts
 * // Plain object update (no immer)
 * const schema = createSchemaWithUpdater(mySlices, {
 *   createUpdateMdw: (store) => function* (ctx, next) {
 *     const updaters = Array.isArray(ctx.updater) ? ctx.updater : [ctx.updater];
 *     let state = store.getState();
 *     for (const updater of updaters) {
 *       const result = updater(state);
 *       if (result !== undefined) state = result;
 *     }
 *     store.setState(state);
 *     yield* next();
 *   },
 * });
 * ```
 */
export function createSchemaWithUpdater<O extends FxMap>(
  slices: O,
  {
    name = "default",
    middleware = [],
    updateMdw,
  }: CreateSchemaWithUpdaterOptions<SliceFromSchema<O>>,
): FxSchema<O> {
  const { db, initialState } = buildSlices(slices);

  // Precomputed middleware will be set on first update call
  const composedMdw: ReturnType<
    typeof compose<UpdaterCtx<SliceFromSchema<O>>>
  > = compose<UpdaterCtx<SliceFromSchema<O>>>([
    updateMdw,
    ...middleware,
    logMdw,
    notifyChannelMdw,
    notifyListenersMdw,
  ]);

  function* update(
    ups: StoreUpdater<SliceFromSchema<O>> | StoreUpdater<SliceFromSchema<O>>[],
  ) {
    const ctx: UpdaterCtx<SliceFromSchema<O>> = {
      updater: ups,
      patches: [],
    };

    if (!composedMdw) {
      throw new Error(
        "Schema update middleware not initialized. Ensure the store is properly initialized before dispatching updates.",
      );
    }

    yield* composedMdw(ctx);

    return ctx;
  }

  function* reset(ignoreList: (string | number | symbol)[] = []) {
    return yield* update((s) => {
      const state = s as Draft<SliceFromSchema<O>>;
      const stateObj = state as unknown as {
        [K in keyof SliceFromSchema<O>]: SliceFromSchema<O>[K];
      };
      const keep = {
        ...(initialState as SliceFromSchema<O>),
      } as SliceFromSchema<O>;

      for (const key of ignoreList as Array<keyof SliceFromSchema<O>>) {
        keep[key] = stateObj[key];
      }

      for (const key of Object.keys(stateObj) as Array<
        keyof SliceFromSchema<O>
      >) {
        stateObj[key] = keep[key];
      }
    });
  }

  const schema = db as FxSchema<O>;
  schema.name = name;
  schema.update = update;
  schema.initialState = initialState as SliceFromSchema<O>;
  schema.reset = reset;

  return schema;
}

/**
 * Creates a schema object from slice factories.
 *
 * @remarks
 * A schema defines the shape of application state and provides reusable
 * state helpers via generated slices. By default, `createSchema` includes
 * `cache` and `loaders` slices used by starfx middleware and supervisors.
 *
 * @param slices - A map of slice factory functions.
 * @param options - Schema options including `name` and custom middleware.
 * @returns A configured schema with `update`, `reset`, and generated slices.
 */
export function createSchema<O extends FxMap>(
  slices?: O,
  options: {
    /**
     * Unique name for this schema. Used to access the schema from the store.
     * @default "default"
     */
    name?: string;
    middleware?: BaseMiddleware<UpdaterCtx<SliceFromSchema<O>>>[];
  } = {},
): FxSchema<O> {
  enablePatches();

  return createSchemaWithUpdater(slices ?? defaultSchema<O>(), {
    name: options.name,
    middleware: options.middleware,
    *updateMdw(ctx: UpdaterCtx<SliceFromSchema<O>>, next: Next) {
      const store: FxStore<O> = yield* expectStore<O>();
      const upds: StoreUpdater<SliceFromSchema<O>>[] = Array.isArray(
        ctx.updater,
      )
        ? ctx.updater
        : [ctx.updater];

      const [nextState, patches, _] = produceWithPatches<SliceFromSchema<O>>(
        store.getState(),
        (draft: Draft<SliceFromSchema<O>>) => {
          upds.forEach((updater) => updater(draft));
        },
      );
      ctx.patches = patches;

      store.setState(nextState);

      yield* next();
    },
  });
}
