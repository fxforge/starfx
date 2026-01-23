import { type Draft, enablePatches, produceWithPatches } from "immer";
import { type BaseMiddleware, compose } from "../compose.js";
import { type AnyState, type Next, StoreContext } from "../index.js";
import { slice } from "./slice/index.js";
import type { LoaderOutput } from "./slice/loaders.js";
import type { TableOutput } from "./slice/table.js";
import { StoreTailMdwContext } from "./store.js";
import type {
  BaseSchema,
  FxMap,
  FxSchema,
  FxStore,
  StoreUpdater,
  UpdaterCtx,
} from "./types.js";

// Default FxMap that includes the built-in `cache` and `loaders` slices
type DefaultFxMap = FxMap & {
  cache: (n: string) => TableOutput<any, AnyState>;
  loaders: (n: string) => LoaderOutput<AnyState, AnyState>;
};

// Helper types to extract the factory return type and its initialState
type FactoryReturn<T> = T extends (name: string) => infer R ? R : never;
type FactoryInitial<T> = FactoryReturn<NonNullable<T>> extends BaseSchema<
  infer IS
>
  ? IS
  : never;

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
  createUpdateMdw: (store: FxStore<S>) => BaseMiddleware<UpdaterCtx<S>>;
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
export function createSchemaWithUpdater<
  O extends FxMap,
  S extends AnyState = { [key in keyof O]: FactoryInitial<O[key]> },
>(
  slices: O,
  {
    name = "default",
    middleware = [],
    createUpdateMdw,
  }: CreateSchemaWithUpdaterOptions<S>,
): FxSchema<S, O> {
  const { db, initialState } = buildSlices(slices);

  // Precomputed middleware will be set on first update call
  let composedMdw: ReturnType<typeof compose<UpdaterCtx<S>>> | null = null;

  function* update(ups: StoreUpdater<S> | StoreUpdater<S>[]) {
    const store = yield* StoreContext.expect();
    const st = store as FxStore<S>;

    // Lazily compose the full middleware stack on first call
    // This allows the store tail middleware context to be set before we compose
    if (!composedMdw) {
      const storeTailMdw = yield* StoreTailMdwContext.expect();
      const updateMdw = createUpdateMdw(st);

      // Precompute full middleware: updateMdw -> user middleware -> store tail
      // Cast the combined array to the explicit middleware type to appease TS
      composedMdw = compose<UpdaterCtx<S>>([
        updateMdw,
        ...(middleware ?? []),
        ...storeTailMdw,
      ] as BaseMiddleware<UpdaterCtx<S>>[]);
    }

    const ctx: UpdaterCtx<S> = {
      updater: ups,
      patches: [],
    };

    yield* composedMdw(ctx);

    return ctx;
  }

  function* reset(ignoreList: (string | number | symbol)[] = []) {
    return yield* update((s) => {
      const state = s as Draft<S>;
      const stateObj = state as unknown as { [K in keyof S]: S[K] };
      const keep = { ...(initialState as S) } as S;

      for (const key of ignoreList as Array<keyof S>) {
        keep[key] = stateObj[key];
      }

      for (const key of Object.keys(stateObj) as Array<keyof S>) {
        stateObj[key] = keep[key];
      }
    });
  }

  const schema = db as FxSchema<S, O>;
  schema.name = name;
  schema.update = update;
  schema.initialState = initialState as S;
  schema.reset = reset;

  return schema;
}

/**
 * Creates a schema with immer-based state updates.
 * This is the default implementation that uses immer's produceWithPatches.
 */
export function createSchema<
  S extends AnyState,
  O extends FxMap = DefaultFxMap,
>(
  slices?: O,
  options: {
    /**
     * Unique name for this schema. Used to access the schema from the store.
     * @default "default"
     */
    name?: string;
    middleware?: BaseMiddleware<UpdaterCtx<S>>[];
  } = {},
): FxSchema<S, O> {
  enablePatches();

  return createSchemaWithUpdater<O, S>(slices ?? defaultSchema<O>(), {
    name: options.name,
    middleware: options.middleware,
    createUpdateMdw: (store: FxStore<S>) =>
      function* updateMdw(ctx: UpdaterCtx<S>, next: Next) {
        const upds: StoreUpdater<S>[] = Array.isArray(ctx.updater)
          ? ctx.updater
          : [ctx.updater];

        const [nextState, patches, _] = produceWithPatches<S>(
          store.getState(),
          (draft: Draft<S>) => {
            upds.forEach((updater) => updater(draft));
          },
        );
        ctx.patches = patches;

        store.setState(nextState);

        yield* next();
      },
  });
}
