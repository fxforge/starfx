import type { Context, Operation, Scope, Task } from "effection";
import type { Draft, Patch } from "immer";
import type { BaseCtx } from "../index.js";
import type { AnyAction, AnyState } from "../types.js";
import type { createRun } from "./run.js";
import type { LoaderOutput } from "./slice/loaders.js";
import type { TableOutput } from "./slice/table.js";

export type StoreUpdater<S extends AnyState> = (s: S | Draft<S>) => S | void;

export type Listener = () => void;

export interface UpdaterCtx<S extends AnyState> extends BaseCtx {
  updater: StoreUpdater<S> | StoreUpdater<S>[];
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

export interface FxMap {
  // keep a typed shape for default slices while allowing user-defined slices
  loaders?: (s: string) => LoaderOutput<AnyState, AnyState>;
  cache?: (s: string) => TableOutput<AnyState, AnyState>;
  [key: string]: ((name: string) => BaseSchema<unknown>) | undefined;
}

export type FxSchema<S extends AnyState, O extends FxMap = FxMap> = {
  [key in keyof O]: ReturnType<NonNullable<O[key]>>;
} & {
  name: string;
  update: (u: StoreUpdater<S> | StoreUpdater<S>[]) => Operation<UpdaterCtx<S>>;
  initialState: S;
  reset: <K extends keyof S = keyof S>(
    ignoreList?: K[],
  ) => Operation<UpdaterCtx<S>>;
};

export interface FxStore<S extends AnyState> {
  getScope: () => Scope;
  // part of redux store API
  getState: () => S;
  setState: (s: S) => void;
  // part of redux store API
  subscribe: (fn: Listener) => () => void;
  // the default schema for this store
  schema: FxSchema<S, FxMap>;
  // all schemas by name
  schemas: Record<string, FxSchema<AnyState, FxMap>>;
  manage: <Resource>(
    name: string,
    resource: Operation<Resource>,
  ) => Context<Resource>;
  run: ReturnType<typeof createRun>;
  initialize: <T>(op: () => Operation<T>) => Task<void>;
  // part of redux store API
  dispatch: (a: AnyAction | AnyAction[]) => unknown;
  // part of redux store API
  replaceReducer: (r: (s: S, a: AnyAction) => S) => void;
  getInitialState: () => S;
  [Symbol.observable]: () => unknown;
}

export interface QueryState {
  cache: TableOutput<any, any>["initialState"];
  loaders: LoaderOutput<any, any>["initialState"];
}
