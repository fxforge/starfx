import { updateStore } from "./fx.js";
import { slice } from "./slice/index.js";
import type { FxMap, FxSchema, StoreUpdater } from "./types.js";

const defaultSchema = <O>(): O =>
  ({ cache: slice.table(), loaders: slice.loaders() }) as O;

/**
 * Creates a schema object and initial state from slice factories.
 *
 * @remarks
 * A schema defines the shape of your application state and provides reusable
 * state management utilities. It is composed of "slices" that each represent
 * a piece of state with associated update and query helpers.
 *
 * By default, `createSchema` requires `cache` and `loaders` slices which are
 * used internally by starfx middleware and supervisors. These slices enable
 * powerful features like automatic request caching and loader state tracking.
 *
 * Returns a tuple of `[schema, initialState]` where:
 * - `schema` contains all slice helpers/selectors plus an `update()` method
 * - `initialState` is the combined initial state from all slices
 *
 * @typeParam O - Map of slice factory functions.
 * @typeParam S - Inferred state shape from the slices.
 * @param slices - A map of slice factory functions. Defaults to a schema
 *   containing `cache` and `loaders` slices.
 * @returns A tuple of `[schema, initialState]`.
 *
 * @see {@link slice} for available slice types.
 * @see {@link https://zod.dev | Zod} for the inspiration behind this API.
 *
 * @example Basic usage
 * ```ts
 * import { createSchema, slice } from 'starfx';
 *
 * interface User {
 *   id: string;
 *   name: string;
 * }
 *
 * const [schema, initialState] = createSchema({
 *   cache: slice.table(),
 *   loaders: slice.loaders(),
 *   users: slice.table<User>({ empty: { id: '', name: '' } }),
 *   counter: slice.num(0),
 *   settings: slice.obj({ theme: 'light', notifications: true }),
 * });
 *
 * type AppState = typeof initialState;
 * ```
 *
 * @example Using the schema
 * ```ts
 * const fetchUsers = api.get('/users', function* (ctx, next) {
 *   // do work before the request
 *   yield* next();
 *   if (!ctx.json.ok) return;
 *
 *   const users = ctx.json.value.reduce((acc, u) => {
 *     acc[u.id] = u;
 *     return acc;
 *   }, {});
 *
 *   // Type-safe state updates
 *   yield* schema.update(schema.users.add(users));
 *
 *   // Type-safe selectors
 *   const allUsers = yield* select(schema.users.selectTableAsList);
 *   const user = yield* select(schema.users.selectById, { id: '1' });
 * }
 * ```
 */
export function createSchema<
  O extends FxMap,
  S extends { [key in keyof O]: ReturnType<O[key]>["initialState"] },
>(slices: O = defaultSchema<O>()): [FxSchema<S, O>, S] {
  const db = Object.keys(slices).reduce<FxSchema<S, O>>(
    (acc, key) => {
      (acc as any)[key] = slices[key](key);
      return acc;
    },
    {} as FxSchema<S, O>,
  );

  const initialState = Object.keys(db).reduce((acc, key) => {
    (acc as any)[key] = db[key].initialState;
    return acc;
  }, {}) as S;

  function* update(ups: StoreUpdater<S> | StoreUpdater<S>[]) {
    return yield* updateStore(ups);
  }

  db.update = update;

  return [db, initialState];
}
