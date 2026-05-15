import {
  type Channel,
  type Operation,
  createChannel,
  createContext,
} from "effection";
import type { AnyAction, AnyState } from "../types.js";
import type {
  AnyFxSchema,
  FxSchema,
  FxStore,
  MergeSchemaRegistryMaps,
  SchemaMap,
  SchemaMapOf,
  StoreSchemaRegistry,
  StoreUpdater,
} from "./types.js";

type StoreContextValue = Omit<
  FxStore<SchemaMap, StoreSchemaRegistry<AnyFxSchema>>,
  "getState" | "setState" | "replaceReducer" | "getInitialState"
> & {
  getState: () => AnyState;
  setState: (upds: StoreUpdater<AnyState>[]) => unknown;
  replaceReducer: (r: (s: AnyState, a: AnyAction) => AnyState) => void;
  getInitialState: () => AnyState;
};

type StoreTypeHint = AnyFxSchema | StoreSchemaRegistry;

type StoreFromTypeHint<T> = [T] extends [StoreSchemaRegistry]
  ? FxStore<MergeSchemaRegistryMaps<T>, T>
  : [T] extends [FxSchema]
    ? FxStore<SchemaMapOf<T>, StoreSchemaRegistry<T>>
    : StoreContextValue;

/**
 * Channel used to notify that the store update sequence completed.
 *
 * Consumers may `StoreUpdateContext.expect()` this context to access
 * store lifecycle notifications through the channel.
 */
export const StoreUpdateContext = createContext<Channel<void, void>>(
  "starfx:store:update",
  createChannel<void, void>(),
);

/**
 * Context that holds the active `FxStore` for the current scope.
 *
 * Use `expectStore()` within operations to access the store instance.
 */
export const StoreContext = createContext<StoreContextValue>("starfx:store");

/**
 * Retrieves the active store from Effection context with an optional type hint.
 *
 * @remarks
 * `StoreContext` is a single global context, so a bare `StoreContext.expect()` can
 * only return a broad store type. Use `expectStore()` when you want a
 * more specific store shape for `getState()`, `schema`, or `schemas`.
 *
 * Pass the schema you already used to create the store:
 * - a single schema, e.g. `expectStore<typeof schema>()`
 * - a schema registry, e.g. `expectStore<typeof schemas>()`
 *
 * @typeParam T - A type hint describing the store shape.
 * @returns The active store from `StoreContext`, narrowed by the provided type hint.
 *
 * @example
 * ```ts
 * const schema = createSchema({ users: slice.table<User>() });
 * const store = yield* expectStore<typeof schema>();
 * store.schema.users.selectTableAsList;
 * ```
 *
 * @example
 * ```ts
 * const schemas = { default: baseSchema, metadata: metadataSchema };
 * const store = yield* expectStore<typeof schemas>();
 * const state = store.getState();
 * state.metadata;
 * ```
 *
 */
export function expectStore<T extends StoreTypeHint>(): Operation<
  StoreFromTypeHint<T>
>;
export function expectStore(): Operation<StoreContextValue>;
export function* expectStore<T extends StoreTypeHint>() {
  return (yield* StoreContext.expect()) as StoreFromTypeHint<T>;
}
