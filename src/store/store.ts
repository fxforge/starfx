import {
  type Operation,
  type Scope,
  createContext,
  createScope,
  createSignal,
  suspend,
} from "effection";
import { produce } from "immer";
import { ActionContext, emit } from "../action.js";
import { parallel } from "../fx/parallel.js";
import { supervise } from "../fx/supervisor.js";
import type { AnyAction } from "../types.js";
import { StoreContext } from "./context.js";
import { createRun } from "./run.js";
import type {
  FxMap,
  FxSchema,
  FxStore,
  Listener,
  SliceFromSchema,
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

/**
 * Creates a managed resource within the store's Effection scope.
 *
 * @remarks
 * The `manage` function allows you to define a resource that can be passed to
 * the `createStore({ tasks: [() => manage(...)] })` configuration. This resource will be automatically
 * initialized and cleaned up with the store's lifecycle. The provided resource is made available through a generated context that can be accessed by any operation within the store's scope.
 *
 * @param name - A unique name for the resource, used to create a context.
 * @param inputResource - An Effection operation that initializes the resource.
 * @returns A context object with an `initialize` method for setting up the resource.
 */
export function manage<Resource>(
  name: string,
  inputResource: Operation<Resource>,
) {
  const CustomContext = createContext<Resource>(name);
  function initialize(parentScope: Scope) {
    return supervise(function* () {
      const providedResource = yield* inputResource;
      parentScope.set(CustomContext, providedResource);
      yield* suspend();
    });
  }

  // returns to the user so they can use this resource from
  //  anywhere this context is available
  return { ...CustomContext, initialize };
}

export interface CreateStore<O extends FxMap> {
  scope?: Scope;
  schema?: FxSchema<O>;
  schemas?: FxSchema<O>[];
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
 * @param options.schemas - Schema list used to compose initial state.
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
 * const store = createStore({ schemas: [schema] });
 * ```
 */
export function createStore<O extends FxMap>({
  scope: initScope,
  schema: singleSchema,
  schemas: multiSchemas,
  tasks = [],
}: CreateStore<O>): FxStore<O> {
  // ensure only schema or schemas is provided, not both or neither
  if (singleSchema && multiSchemas) {
    throw new Error("Provide either `schema` or `schemas`, not both.");
  }
  if (!singleSchema && !multiSchemas) {
    throw new Error("At least one schema must be provided.");
  }

  // normalize to array of schemas for easier processing
  let schemas: FxSchema<O>[];
  if (singleSchema) {
    schemas = [singleSchema];
  } else if (multiSchemas) {
    schemas = multiSchemas;
  } else {
    throw new Error("Provide either `schema` or `schemas`.");
  }
  const baseSchema = schemas[0];

  const [scope] = initScope ? [initScope] : createScope();

  const listeners = new Set<Listener>();
  scope.set(ListenersContext, listeners);

  const signal = createSignal<AnyAction, void>();
  scope.set(ActionContext, signal);
  scope.set(IdContext, id++);

  // Build schemas map by name for selective access
  const schemasMap = schemas.reduce(
    (acc, s) => {
      acc[s.name] = s;
      return acc;
    },
    {} as Record<string, FxSchema<O>>,
  );

  // Build initial state from all schemas
  const initialState = schemas.reduce(
    (acc, schema) => {
      return Object.assign(acc, schema.initialState);
    },
    {} as SliceFromSchema<O>,
  );
  let state = initialState;

  function getScope() {
    return scope;
  }

  function getState() {
    return state;
  }

  function setState(newState: SliceFromSchema<O>) {
    // enables merging multiple states from
    // different schemas without overwriting the whole state
    // TODO but this means double produce on the default single schema case
    state = produce(state, (draft) => {
      Object.assign(draft, newState);
    });
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

  const store: FxStore<O> = {
    getScope,
    getState,
    setState,
    subscribe,
    manage,
    schema: baseSchema,
    schemas: schemasMap,
    run,
    // instead of actions relating to store mutation, they
    // refer to pieces of business logic -- that can also mutate state
    dispatch,
    // stubs so `react-redux` is happy
    replaceReducer(
      _nextReducer: (s: SliceFromSchema<O>, a: AnyAction) => SliceFromSchema<O>,
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
