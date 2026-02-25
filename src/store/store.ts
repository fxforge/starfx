import {
  type Callable,
  type Operation,
  type Scope,
  type Task,
  createContext,
  createScope,
  createSignal,
  each,
  lift,
  suspend,
} from "effection";
import { ActionContext, emit } from "../action.js";
import { createReplaySignal } from "../fx/replay-signal.js";
import type { AnyAction } from "../types.js";
import { StoreContext } from "./context.js";
import { createRun } from "./run.js";
import type {
  FxMap,
  FxSchema,
  FxStore,
  Listener,
  SliceFromSchema,
  UpdaterCtx,
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
  schemas: FxSchema<O>[];
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
  schemas,
}: CreateStore<O>): FxStore<O> {
  let scope: Scope;
  if (initScope) {
    scope = initScope;
  } else {
    const tuple = createScope();
    scope = tuple[0];
  }

  // Build initial state from all schemas
  const initialState = schemas.reduce(
    (acc, schema) => {
      return Object.assign(acc, schema.initialState);
    },
    {} as SliceFromSchema<O>,
  );
  let state = initialState;
  const listeners = new Set<Listener>();
  scope.set(ListenersContext, listeners);

  const signal = createSignal<AnyAction, void>();
  const watch = createReplaySignal<Callable<Operation<void>>, void>();
  scope.set(ActionContext, signal);
  scope.set(IdContext, id++);

  function getScope() {
    return scope;
  }

  function getState() {
    return state;
  }

  function setState(newState: SliceFromSchema<O>) {
    state = newState;
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

  function manage<Resource>(name: string, inputResource: Operation<Resource>) {
    const CustomContext = createContext<Resource>(name);
    function* manager() {
      const providedResource = yield* inputResource;
      scope.set(CustomContext, providedResource);
      yield* suspend();
    }
    watch.send(manager);

    // returns to the user so they can use this resource from
    //  anywhere this context is available
    return CustomContext;
  }

  const run = createRun(scope);

  function initialize<T>(op: () => Operation<T>): Task<void> {
    return scope.run(function* (): Operation<void> {
      yield* scope.spawn(function* () {
        for (const watched of yield* each(watch)) {
          yield* scope.spawn(watched);
          yield* each.next();
        }
      });
      yield* op();
    });
  }

  // Use the first schema as the default
  const schema = schemas[0];

  // Build schemas map by name for selective access
  const schemasMap = schemas.reduce(
    (acc, s) => {
      acc[s.name] = s;
      return acc;
    },
    {} as Record<string, FxSchema<O>>,
  );

  const store: FxStore<O> = {
    getScope,
    getState,
    setState,
    subscribe,
    initialize,
    manage,
    schema,
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
  return store;
}
