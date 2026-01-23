import {
  type Callable,
  Ok,
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
import { API_ACTION_PREFIX, ActionContext, emit } from "../action.js";
import type { BaseMiddleware } from "../compose.js";
import { createReplaySignal } from "../fx/replay-signal.js";
import type { AnyAction, AnyState, Next } from "../types.js";
import { StoreContext, StoreUpdateContext } from "./context.js";
import { createRun } from "./run.js";
import type { FxSchema, FxStore, Listener, UpdaterCtx } from "./types.js";
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

export interface CreateStore<S extends AnyState> {
  scope?: Scope;
  schemas: FxSchema<S, any>[];
}

export const IdContext = createContext("starfx:id", 0);

// Context to share store's tail middleware with schemas
export const StoreTailMdwContext = createContext<
  BaseMiddleware<UpdaterCtx<AnyState>>[]
>("starfx:store-tail-mdw", [] as BaseMiddleware<UpdaterCtx<AnyState>>[]);

export function createStore<S extends AnyState>({
  scope: initScope,
  schemas,
}: CreateStore<S>): FxStore<S> {
  let scope: Scope;
  if (initScope) {
    scope = initScope;
  } else {
    const tuple = createScope();
    scope = tuple[0];
  }

  // Build initial state from all schemas
  const initialState = schemas.reduce((acc, schema) => {
    return Object.assign(acc, schema.initialState);
  }, {} as AnyState) as S;
  let state = initialState;
  const listeners = new Set<Listener>();

  const signal = createSignal<AnyAction, void>();
  const watch = createReplaySignal<any, void>();
  scope.set(ActionContext, signal);
  scope.set(IdContext, id++);

  function getScope() {
    return scope;
  }

  function getState() {
    return state;
  }

  function setState(newState: S) {
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

  function* logMdw(ctx: UpdaterCtx<S>, next: Next) {
    yield* lift(dispatch)({
      type: `${API_ACTION_PREFIX}store`,
      payload: ctx,
    });
    yield* next();
  }

  function* notifyChannelMdw(_: UpdaterCtx<S>, next: Next) {
    const chan = yield* StoreUpdateContext.expect();
    yield* chan.send();
    yield* next();
  }

  function* notifyListenersMdw(_: UpdaterCtx<S>, next: Next) {
    listeners.forEach((f) => f());
    yield* next();
  }

  // Set the store's tail middleware in context for schemas to use
  const storeTailMdw: BaseMiddleware<UpdaterCtx<S>>[] = [
    logMdw,
    notifyChannelMdw,
    notifyListenersMdw,
  ];
  scope.set(
    StoreTailMdwContext,
    storeTailMdw as BaseMiddleware<UpdaterCtx<AnyState>>[],
  );

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
  const schema: FxSchema<S, any> = schemas[0] as FxSchema<S, any>;

  // Build schemas map by name for selective access
  const schemasMap = schemas.reduce(
    (acc, s) => {
      acc[s.name] = s as FxSchema<any, any>;
      return acc;
    },
    {} as Record<string, FxSchema<any, any>>,
  );

  const store: FxStore<S> = {
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
    replaceReducer<S = any>(
      _nextReducer: (_s: S, _a: AnyAction) => void,
    ): void {
      throw new Error(stubMsg);
    },
    getInitialState,
    [Symbol.observable]: observable,
  };

  scope.set(StoreContext, store as FxStore<AnyState>);
  return store;
}

/**
 * @deprecated use {@link createStore}
 */
export const configureStore = createStore;
