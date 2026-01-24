import type { Operation, Scope } from "effection";
import type { Patch } from "immer";
import type { BaseCtx } from "../index.js";
import type { AnyAction, AnyState } from "../types.js";
import type { createRun } from "./run.js";
import type { LoaderOutput } from "./slice/loaders.js";
import type { TableOutput } from "./slice/table.js";

/**
 * A function that applies mutations to the store state.
 */
export type StoreUpdater<S extends AnyState> = (s: S) => S | void;

/**
 * Simple listener callback type used by `subscribe`.
 */
export type Listener = () => void;

/**
 * Context passed to store update middleware.
 */
export interface UpdaterCtx<S extends AnyState> extends BaseCtx {
  updater: StoreUpdater<S> | StoreUpdater<S>[];
  patches: Patch[];
}

declare global {
  interface SymbolConstructor {
    readonly observable: symbol;
  }
}

/**
 * Base description of a slice factory (schema output) used to build Fx schemas.
 */
export interface BaseSchema<TOutput> {
  initialState: TOutput;
  schema: string;
  name: string;
}

export type Output<O extends { [key: string]: BaseSchema<unknown> }> = {
  [key in keyof O]: O[key]["initialState"];
};

/**
 * Map of slice factories used when creating a schema via {@link createSchema}.
 */
export interface FxMap {
  loaders: <M extends AnyState>(s: string) => LoaderOutput<M, AnyState>;
  cache: (s: string) => TableOutput<any, AnyState>;
  [key: string]: (name: string) => BaseSchema<unknown>;
}

/**
 * Generated schema type mapping slice factories to their runtime output helpers.
 */
export type FxSchema<S extends AnyState, O extends FxMap = FxMap> = {
  [key in keyof O]: ReturnType<O[key]>;
} & { update: FxStore<S>["update"] };

/**
 * Runtime store instance exposing state, update, and effect helpers.
 */
export interface FxStore<S extends AnyState> {
  getScope: () => Scope;
  getState: () => S;
  subscribe: (fn: Listener) => () => void;
  update: (u: StoreUpdater<S> | StoreUpdater<S>[]) => Operation<UpdaterCtx<S>>;
  reset: (ignoreList?: (keyof S)[]) => Operation<UpdaterCtx<S>>;
  run: ReturnType<typeof createRun>;
  dispatch: (a: AnyAction | AnyAction[]) => any;
  replaceReducer: (r: (s: S, a: AnyAction) => S) => void;
  getInitialState: () => S;
  [Symbol.observable]: () => any;
}

/**
 * Minimal shape of the generated `QueryState`.
 */
export interface QueryState {
  cache: TableOutput<any, any>["initialState"];
  loaders: LoaderOutput<any, any>["initialState"];
}
