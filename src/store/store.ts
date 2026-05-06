import {
  type Operation,
  type Scope,
  createContext,
  createScope,
  createSignal,
} from "effection";
import { type Draft, enablePatches, produceWithPatches } from "immer";
import { ActionContext, emit } from "../action.js";
import { parallel } from "../fx/parallel.js";
import type { AnyAction } from "../types.js";
import { StoreContext } from "./context.js";
import { createRun } from "./run.js";
import { DEFAULT_SCHEMA_KEY } from "./types.js";
import type {
  AnyFxSchema,
  FxMap,
  FxSchema,
  FxStore,
  Listener,
  MergeSchemaRegistryMaps,
  SliceFromSchema,
  StoreSchemaRegistry,
  StoreUpdater,
} from "./types.js";
const stubMsg = "This is merely a stub, not implemented";

let id = 0;

// https://github.com/reduxjs/redux/blob/4a6d2fb227ba119d3498a43fab8f53fe008be64c/src/createStore.js#L344
function observable() {
  return {
    subscribe: (_observer: unknown) => {
      throw new Error(stubMsg);
    },
    [Symbol.observable]() {
      return this;
    },
  };
}

export interface CreateStore<O extends FxMap> {
  scope?: Scope;
  schema: FxSchema<O>;
  /**
   * Long-lived startup operations to run inside the store scope.
   *
   * These tasks are lifecycle-managed by the store, but `createStore()` does
   * not guarantee that arbitrary custom tasks have reached a caller-defined
   * ready state before the first dispatch. If a custom task needs stronger
   * startup coordination, it should expose and manage that readiness explicitly
   * using existing primitives.
   */
  tasks?: (() => Operation<void>)[];
}

export interface CreateStoreMulti<TSchemas extends StoreSchemaRegistry> {
  scope?: Scope;
  schema: TSchemas;
  tasks?: (() => Operation<void>)[];
}

export const IdContext = createContext("starfx:id", 0);
export const ListenersContext = createContext<Set<Listener>>(
  "starfx:store:listeners",
  new Set<Listener>(),
);

/**
 * Creates a new FxStore instance for managing application state.
 *
 * @remarks
 * The store wraps an Effection scope and provides state management primitives,
 * listener registration, middleware application, and a `run` helper for
 * executing operations within the store's scope.
 *
 * Unlike traditional Redux stores, this store does not use reducers. Instead,
 * state updates are performed with immer-based updater functions that mutate
 * draft state.
 *
 * @typeParam O - Slice factory map used to build schema/state shape.
 * @param options - Store configuration object.
 * @param options.scope - Optional Effection scope to use.
 * @param options.schema - Single schema or a keyed schema registry whose
 * `default` entry defines `store.schema`.
 * @param options.tasks - Long-lived startup operations to run in the
 * store scope. Arbitrary custom tasks are started with the store, but they are
 * not awaited to a caller-defined ready state.
 * @returns A fully configured store instance.
 *
 * @example
 * ```ts
 * const schema = createSchema({
 *   users: slice.table<User>(),
 *   cache: slice.table(),
 *   loaders: slice.loaders(),
 * });
 *
 * const store = createStore({ schema });
 * ```
 */
export function createStore<O extends FxMap>(
  options: CreateStore<O>,
): FxStore<O>;
export function createStore<const TSchemas extends StoreSchemaRegistry>(
  options: CreateStoreMulti<TSchemas>,
): FxStore<MergeSchemaRegistryMaps<TSchemas>, TSchemas>;
export function createStore({
  scope: initScope,
  schema: schemaInput,
  tasks = [],
}: CreateStore<FxMap> | CreateStoreMulti<StoreSchemaRegistry>): FxStore<
  FxMap,
  StoreSchemaRegistry<FxSchema<FxMap>>
> {
  if (!schemaInput) {
    throw new Error("At least one schema must be provided.");
  }

  if (!isFxSchema(schemaInput) && !isSchemaRegistry(schemaInput)) {
    throw new Error("A schema registry must include `default`");
  }

  const schemasMap: StoreSchemaRegistry<FxSchema<FxMap>> = isSchemaRegistry(
    schemaInput,
  )
    ? (schemaInput as StoreSchemaRegistry<FxSchema<FxMap>>)
    : { [DEFAULT_SCHEMA_KEY]: schemaInput as FxSchema<FxMap> };
  const schemas = Object.values(schemasMap);
  const baseSchema = schemasMap[DEFAULT_SCHEMA_KEY];

  const [scope] = initScope ? [initScope] : createScope();

  const listeners = new Set<Listener>();
  scope.set(ListenersContext, listeners);

  const signal = createSignal<AnyAction, void>();
  scope.set(ActionContext, signal);
  scope.set(IdContext, id++);

  enablePatches();
  // Build initial state from all schemas
  const initialState = schemas.reduce(
    (acc, schema) => {
      return Object.assign(acc, schema.initialState);
    },
    {} as SliceFromSchema<FxMap>,
  );
  let state = initialState;

  function getScope() {
    return scope;
  }

  function getState() {
    return state;
  }

  function setState(upds: StoreUpdater<SliceFromSchema<FxMap>>[]) {
    const nextState = produceWithPatches(
      state,
      (draft: Draft<SliceFromSchema<FxMap>>) => {
        upds.forEach((updater) => updater(draft));
      },
    );

    state = nextState[0];
    return nextState;
  }

  function getInitialState() {
    return initialState;
  }

  function subscribe(fn: Listener) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  }

  function dispatch(action: AnyAction | AnyAction[]) {
    emit({ signal, action });
  }

  const run = createRun(scope);

  const store: FxStore<FxMap, StoreSchemaRegistry<FxSchema<FxMap>>> = {
    getScope,
    getState,
    setState,
    subscribe,
    schema: baseSchema,
    schemas: schemasMap,
    run,
    // instead of actions relating to store mutation, they
    // refer to pieces of business logic -- that can also mutate state
    dispatch,
    // stubs so `react-redux` is happy
    replaceReducer(
      _nextReducer: (
        s: SliceFromSchema<FxMap>,
        a: AnyAction,
      ) => SliceFromSchema<FxMap>,
    ): void {
      throw new Error(stubMsg);
    },
    getInitialState,
    [Symbol.observable]: observable,
  };

  scope.set(StoreContext, store as FxStore<FxMap>);

  run(function* (): Operation<void> {
    const schemaInit = schemas
      .map((s) => s.initialize)
      .filter(
        (init): init is () => Operation<void> => typeof init === "function",
      );

    const group = yield* parallel([...schemaInit, ...tasks]);
    yield* group;
  });

  return store;
}

function isSchemaRegistry(
  schema: AnyFxSchema | StoreSchemaRegistry,
): schema is StoreSchemaRegistry {
  return (
    typeof schema === "object" &&
    schema !== null &&
    DEFAULT_SCHEMA_KEY in schema &&
    isFxSchema(schema[DEFAULT_SCHEMA_KEY])
  );
}

function isFxSchema(value: unknown): value is AnyFxSchema {
  return (
    typeof value === "object" &&
    value !== null &&
    "update" in value &&
    "initialState" in value
  );
}
