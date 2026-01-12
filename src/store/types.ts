import type { Context, Operation, Scope, Task } from "effection";
import type { Patch } from "immer";
import type { BaseCtx } from "../index.js";
import type { AnyAction, AnyState } from "../types.js";
import type { createRun } from "./run.js";
import type { LoaderOutput } from "./slice/loaders.js";
import type { TableOutput } from "./slice/table.js";

export type StoreUpdater<S extends AnyState> = (s: S) => S | void;

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
  loaders: <M extends AnyState>(s: string) => LoaderOutput<M, AnyState>;
  cache: (s: string) => TableOutput<any, AnyState>;
  [key: string]: (name: string) => BaseSchema<unknown>;
}

export type FxSchema<S extends AnyState, O extends FxMap = FxMap> = {
  [key in keyof O]: ReturnType<O[key]>;
} & { update: FxStore<S>["update"] };

export interface FxStore<S extends AnyState> {
  getScope: () => Scope;
  getState: () => S;
  subscribe: (fn: Listener) => () => void;
  update: (u: StoreUpdater<S> | StoreUpdater<S>[]) => Operation<UpdaterCtx<S>>;
  reset: (ignoreList?: (keyof S)[]) => Operation<UpdaterCtx<S>>;
  manage: <Resource>(
    name: string,
    resource: Operation<Resource>,
  ) => Context<Resource>;
  run: ReturnType<typeof createRun>;
  initialize: <T>(op: () => Operation<T>) => Task<void>;
  dispatch: (a: AnyAction | AnyAction[]) => any;
  replaceReducer: (r: (s: S, a: AnyAction) => S) => void;
  getInitialState: () => S;
  [Symbol.observable]: () => any;
}

export interface QueryState {
  cache: TableOutput<any, any>["initialState"];
  loaders: LoaderOutput<any, any>["initialState"];
}
