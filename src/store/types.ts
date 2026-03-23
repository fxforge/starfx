import type { Context, Operation, Scope, Task } from "effection";
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
  /**
   * Return the Effection Scope associated with this store.
   */
  getScope: () => Scope;

  /**
   * Return the current state value.
   */
  getState: () => S;

  /**
   * Subscribe to state changes. Returns an unsubscribe function.
   *
   * @param fn - listener called on every update
   */
  subscribe: (fn: Listener) => () => void;

  /**
   * Apply an immutable update (or array of updates) to the state.
   * Returns an Operation yielding the updater context (including patches).
   *
   * @param u - StoreUpdater or array of StoreUpdater
   */
  update: (u: StoreUpdater<S> | StoreUpdater<S>[]) => Operation<UpdaterCtx<S>>;

  /**
   * Reset the state to the initial state, optionally preserving keys in ignoreList.
   *
   * @param ignoreList - keys to retain from the current state
   */
  reset: (ignoreList?: (keyof S)[]) => Operation<UpdaterCtx<S>>;

  /**
   * Start and expose an Effection resource within the store scope.
   *
   * @param name - unique name for the resource Context
   * @param resource - an Effection Operation (usually created with `resource(...)`)
   * @returns a `Context<Resource>` that can `get()` or `expect()` in thunks/apis
   */
  manage: <Resource>(
    name: string,
    resource: Operation<Resource>,
  ) => Context<Resource>;

  /**
   * Run a single or array of operation(s) inside the store's scope.
   *
   * Use `store.run(...)` to execute ad-hoc tasks or one-off operations. For
   * long-running background watchers or to start resources registered via
   * `.manage()` you must call `initialize(...)` which starts the store's
   * internal watcher loop (and is required for `.manage()` and
   * `thunks.register`). It is unlikely you will need to call `store.run(...)`
   * directly in typical usage.
   */
  run: ReturnType<typeof createRun>;

  /**
   * Initialize the store along with passed operations.
   *
   * `initialize(op)` starts `op` inside the store scope and spawns the
   * internal watcher loop that starts resources registered via `.manage()`.
   * Typical usage:
   * ```ts
   * store.initialize(thunks.register);
   * ```
   *
   * @param op - function returning an Operation that will run in the store scope
   */
  initialize: <T>(op: () => Operation<T>) => Task<void>;

  /**
   * Dispatch an action (or array of actions) into the store's action channel.
   */
  dispatch: (a: AnyAction | AnyAction[]) => any;

  /**
   * Stubbed for compatibility with redux APIs. Not implemented.
   */
  replaceReducer: (r: (s: S, a: AnyAction) => S) => void;

  /**
   * Return the initial state used when the store was created.
   */
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
