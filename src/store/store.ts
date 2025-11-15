import {
  type Callable,
  Ok,
  type Result,
  type Scope,
  type Task,
  createContext,
  createScope,
  createSignal,
} from "effection";
import { enablePatches, produceWithPatches } from "immer";
import { API_ACTION_PREFIX, ActionContext, emit } from "../action.js";
import { type BaseMiddleware, compose } from "../compose.js";
import type { AnyAction, AnyState, Next } from "../types.js";
import { StoreContext, StoreUpdateContext } from "./context.js";
import { createRun } from "./run.js";
import type { FxStore, Listener, StoreUpdater, UpdaterCtx } from "./types.js";
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
  initialState: S;
  middleware?: BaseMiddleware<UpdaterCtx<S>>[];
  setStoreUpdater?: (
    setState: (state: S) => void,
    getState: () => S,
    getInitialState?: () => S,
  ) => {
    updateMdw: BaseMiddleware<UpdaterCtx<S>>;
    initializeStore: Callable<any>;
  };
}

export const IdContext = createContext("starfx:id", 0);

const defaultStoreUpdater = <S extends AnyState, T>(
  setState: (state: S) => void,
  getState: () => S,
) => {
  enablePatches();

  function* updateMdw(ctx: UpdaterCtx<S>, next: Next) {
    const upds: StoreUpdater<S>[] = [];

    if (Array.isArray(ctx.updater)) {
      upds.push(...ctx.updater);
    } else {
      upds.push(ctx.updater);
    }

    const [nextState, patches, _] = produceWithPatches(getState(), (draft) => {
      // TODO: check for return value inside updater
      upds.forEach((updater) => updater(draft as any));
    });
    ctx.patches = patches;

    // set the state!
    setState(nextState);

    yield* next();
  }

  const initializeStore = function* () {};
  return { updateMdw, initializeStore };
};

export function createStore<S extends AnyState, T>({
  initialState,
  scope: initScope,
  middleware = [],
  setStoreUpdater = defaultStoreUpdater,
}: CreateStore<S>): FxStore<S> {
  let scope: Scope;
  if (initScope) {
    scope = initScope;
  } else {
    const tuple = createScope();
    scope = tuple[0];
  }

  let state = initialState;
  const listeners = new Set<Listener>();

  const signal = createSignal<AnyAction, void>();
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
    dispatch({
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

  const { updateMdw, initializeStore } = setStoreUpdater(
    setState,
    getState,
    getInitialState,
  );
  function createUpdater() {
    const fn = compose<UpdaterCtx<S>>([
      updateMdw,
      ...middleware,
      logMdw,
      notifyChannelMdw,
      notifyListenersMdw,
    ]);

    return fn;
  }

  const mdw = createUpdater();
  function* update(updater: StoreUpdater<S> | StoreUpdater<S>[]) {
    const ctx = {
      updater,
      patches: [],
      result: Ok(undefined),
    };

    yield* mdw(ctx);

    if (!ctx.result.ok) {
      dispatch({
        type: `${API_ACTION_PREFIX}store`,
        payload: ctx.result.error,
      });
    }

    return ctx;
  }

  function* reset(ignoreList: (keyof S)[] = []) {
    return yield* update((s) => {
      const keep = ignoreList.reduce<S>(
        (acc, key) => {
          acc[key] = s[key];
          return acc;
        },
        { ...initialState },
      );

      Object.keys(s).forEach((key: keyof S) => {
        s[key] = keep[key];
      });
    });
  }

  const run = createRun(scope);

  function initialize<T>(op: Callable<T> | Callable<T>[]): Task<Result<T>[]> {
    const ops = Array.isArray(op)
      ? ([initializeStore].concat(op) as Callable<T>[])
      : [initializeStore, op];
    return run(ops);
  }

  const store: FxStore<S> = {
    getScope,
    getState,
    subscribe,
    //@ts-expect-error
    initialize,
    update,
    reset,
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
