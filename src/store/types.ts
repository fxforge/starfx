import type { Operation, Scope } from "effection";
import type { Draft, Immutable, Patch } from "immer";
import type { BaseCtx } from "../compose.js";
import type { AnyAction, AnyState } from "../types.js";
import type { createRun } from "./run.js";
import type { LoaderOutput } from "./slice/loaders.js";
import type { TableOutput } from "./slice/table.js";

/**
 * A function that applies mutations to draft store state.
 *
 * @remarks
 * The function receives an immer Draft and may mutate in place.
 */
export type StoreUpdater<S extends AnyState> = (s: Draft<S>) => S | void;

export type SliceActionFn<S, P = unknown, R = void> = (
  p: P,
) => (s: Draft<S>) => R;
export type SliceSelectorFn<S, P = void, R = unknown> = P extends void
  ? (s: S) => R
  : (s: S, p: P) => R;

/**
 * Simple listener callback type used by `subscribe`.
 */
export type Listener = () => void;

/**
 * Context passed to store update middleware.
 */
export interface UpdaterCtx<
  S extends AnyState,
  U = StoreUpdater<S> | StoreUpdater<S>[],
> extends BaseCtx {
  updater: U;
  patches: Patch[];
}

declare global {
  interface SymbolConstructor {
    readonly observable: symbol;
  }
}

export interface BaseSchema<TOutput> {
  initialState: TOutput;
  schema: string;
  name: string;
}

export type Output<O extends { [key: string]: BaseSchema<unknown> }> = {
  [key in keyof O]: O[key]["initialState"];
};

/**
 * Canonical slice-state view used by generated slice helpers.
 */
export type SliceState<T> = Record<string, Immutable<T>>;

/**
 * Map of slice factories used when creating a schema via createSchema.
 *
 * @remarks
 * Includes optional default `loaders` and `cache` slices while allowing
 * additional user-defined factories.
 */
export interface FxMap {
  // keep a typed shape for default slices while allowing user-defined slices
  loaders?: (s: string) => LoaderOutput;
  cache?: (s: string) => TableOutput<AnyState>;
  [key: string]: ((name: string) => BaseSchema<unknown>) | undefined;
}

// Helper types to extract the factory return type and its initialState
export type FactoryReturn<T> = T extends (name: string) => infer R ? R : never;
export type FactoryInitial<T> = FactoryReturn<
  NonNullable<T>
> extends BaseSchema<infer IS>
  ? IS
  : never;
export type SliceFromSchema<O extends FxMap> = {
  [K in keyof O]: FactoryInitial<O[K]>;
};

type SliceActionUpdater<T> = {
  [K in keyof T]: T[K] extends (...args: never[]) => infer R
    ? R extends StoreUpdater<AnyState>
      ? R
      : never
    : never;
}[keyof T];

type BuiltInSchemaUpdater =
  | SliceActionUpdater<LoaderOutput>
  | SliceActionUpdater<TableOutput<AnyState>>;

export type SchemaUpdater<O extends FxMap> =
  | StoreUpdater<SliceFromSchema<O>>
  | BuiltInSchemaUpdater
  | {
      [K in keyof O]: SliceActionUpdater<ReturnType<NonNullable<O[K]>>>;
    }[keyof O];

/**
 * Generated schema type mapping slice factories to runtime slice helpers.
 *
 * @remarks
 * Extends generated helpers with schema lifecycle/update APIs.
 */
export type FxSchema<O extends FxMap = FxMap> = {
  [K in keyof O]: FactoryReturn<NonNullable<O[K]>>;
} & {
  name: string;
  initialize?: () => Operation<void>;
  update: (
    u: SchemaUpdater<O> | SchemaUpdater<O>[],
  ) => Operation<
    UpdaterCtx<SliceFromSchema<O>, SchemaUpdater<O> | SchemaUpdater<O>[]>
  >;
  initialState: SliceFromSchema<O>;
  reset: <K extends keyof SliceFromSchema<O> = keyof SliceFromSchema<O>>(
    ignoreList?: K[],
  ) => Operation<
    UpdaterCtx<SliceFromSchema<O>, SchemaUpdater<O> | SchemaUpdater<O>[]>
  >;
};

/**
 * Runtime store instance exposing state, update, and effect helpers.
 *
 * @remarks
 * Compatible with react-redux store expectations for interop.
 */
export interface FxStore<O extends FxMap> {
  getScope: () => Scope;
  // part of redux store API
  getState: () => SliceFromSchema<O>;
  setState: (s: SliceFromSchema<O>) => void;
  // part of redux store API
  subscribe: (fn: Listener) => () => void;
  // the default schema for this store
  schema: FxSchema<O>;
  // all schemas by name
  schemas: Record<string, FxSchema<O>>;
  run: ReturnType<typeof createRun>;
  // part of redux store API
  dispatch: (a: AnyAction | AnyAction[]) => unknown;
  // part of redux store API
  replaceReducer: (
    r: (s: SliceFromSchema<O>, a: AnyAction) => SliceFromSchema<O>,
  ) => void;
  getInitialState: () => SliceFromSchema<O>;
  [Symbol.observable]: () => unknown;
}

/**
 * Minimal shape of the generated query state.
 */
export interface QueryState {
  cache: TableOutput<AnyState>["initialState"];
  loaders: LoaderOutput["initialState"];
}
