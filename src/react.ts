import React, { type ReactElement } from "react";
import {
  Provider as ReduxProvider,
  useDispatch,
  useStore as useReduxStore,
  useSelector,
} from "react-redux";
import { getIdFromAction } from "./action.js";
import type { ThunkAction } from "./query/index.js";
import {
  type FxSchema,
  type FxStore,
  PERSIST_LOADER_ID,
} from "./store/index.js";
import type { LoaderOutput } from "./store/slice/loaders.js";
import type { TableOutput } from "./store/slice/table.js";
import type { FxMap } from "./store/types.js";
import type { AnyState, LoaderState } from "./types.js";
import type { ActionFn, ActionFnWithPayload } from "./types.js";

export { useDispatch, useSelector } from "react-redux";
export type { TypedUseSelectorHook } from "react-redux";

const {
  useContext,
  useEffect,
  useRef,
  createContext,
  createElement: h,
} = React;

export interface UseApiProps<P = any> extends LoaderState {
  trigger: (p: P) => void;
  action: ActionFnWithPayload<P>;
}
export interface UseApiSimpleProps extends LoaderState {
  trigger: () => void;
  action: ActionFnWithPayload;
}
export interface UseApiAction<A extends ThunkAction = ThunkAction>
  extends LoaderState {
  trigger: () => void;
  action: A;
}
export type UseApiResult<P, A extends ThunkAction = ThunkAction> =
  | UseApiProps<P>
  | UseApiSimpleProps
  | UseApiAction<A>;

export interface UseCacheResult<D = any, A extends ThunkAction = ThunkAction>
  extends UseApiAction<A> {
  data: D | null;
}

const SchemaContext = createContext<FxSchema<AnyState, FxMap> | null>(null);

// Strongly-typed overload that ties `store` and `schema` to the same state type S
export function Provider<S extends AnyState>(props: {
  store: FxStore<S>;
  schema?: FxSchema<S, any>;
  children?: React.ReactNode;
}): React.ReactElement;

// Provider overload accepting any store and schema to avoid variance issues
export function Provider(props: {
  store: FxStore<any>;
  schema?: FxSchema<any, any>;
  children?: React.ReactNode;
}): React.ReactElement;

// Runtime implementation uses `AnyState` for minimal widening
export function Provider(props: {
  store: FxStore<AnyState>;
  schema?: FxSchema<AnyState, any>;
  children?: React.ReactNode;
}) {
  const { store, schema, children } = props;
  // Use provided schema or pull from store
  const schemaValue = (schema ?? store.schema) as FxSchema<AnyState, any>;
  const inner = h(SchemaContext.Provider, { value: schemaValue }, children);
  return h(ReduxProvider, { store, children: inner });
}

export function useSchema<S extends AnyState>() {
  const ctx = useContext(SchemaContext);
  if (!ctx) throw new Error("No Schema available in context");
  return ctx as FxSchema<S>;
}

// Typed variant for schemas that include `loaders`.
export function useSchemaWithLoaders(): FxSchema<
  AnyState,
  { loaders: (n: string) => LoaderOutput<any, any> }
>;
export function useSchemaWithLoaders<
  S extends { loaders: LoaderOutput<any, any>["initialState"] },
>(): FxSchema<S, { loaders: (n: string) => LoaderOutput<any, any> }>;
export function useSchemaWithLoaders() {
  const ctx = useContext(SchemaContext);
  if (!ctx) throw new Error("No Schema available in context");
  return ctx as FxSchema<
    any,
    { loaders: (n: string) => LoaderOutput<any, any> }
  >;
}

// Typed variant for schemas that include `cache`.
export function useSchemaWithCache(): FxSchema<
  AnyState,
  { cache: (n: string) => TableOutput<any, any> }
>;
export function useSchemaWithCache<
  S extends { cache: TableOutput<any, any>["initialState"] },
>(): FxSchema<S, { cache: (n: string) => TableOutput<any, any> }>;
export function useSchemaWithCache() {
  const ctx = useContext(SchemaContext);
  if (!ctx) throw new Error("No Schema available in context");
  return ctx as FxSchema<any, { cache: (n: string) => TableOutput<any, any> }>;
}

export function useStore<S extends AnyState>() {
  return useReduxStore() as FxStore<S>;
}

/**
 * useLoader will take an action creator or action itself and return the associated
 * loader for it.
 *
 * @returns the loader object for an action creator or action
 *
 * @example
 * ```ts
 * import { useLoader } from 'starfx/react';
 *
 * import { api } from './api';
 *
 * const fetchUsers = api.get('/users', function*() {
 *   // ...
 * });
 *
 * const View = () => {
 *   const loader = useLoader(fetchUsers);
 *   // or: const loader = useLoader(fetchUsers());
 *   return <div>{loader.isLoader ? 'Loading ...' : 'Done!'}</div>
 * }
 * ```
 */
export function useLoader(
  action: ThunkAction | ActionFnWithPayload,
): LoaderState<any>;
export function useLoader<
  S extends { loaders: LoaderOutput<any, any>["initialState"] },
  M extends AnyState = any,
>(action: ThunkAction | ActionFnWithPayload): LoaderState<M>;
export function useLoader(action: any) {
  const schema = useSchemaWithLoaders();
  const id = getIdFromAction(action);
  return useSelector((s: any) => schema.loaders.selectById(s, { id }));
}

/**
 * useApi will take an action creator or action itself and fetch
 * the associated loader and create a `trigger` function that you can call
 * later in your react component.
 *
 * This hook will *not* fetch the data for you because it does not know how to fetch
 * data from your redux state.
 *
 * @example
 * ```ts
 * import { useApi } from 'starfx/react';
 *
 * import { api } from './api';
 *
 * const fetchUsers = api.get('/users', function*() {
 *   // ...
 * });
 *
 * const View = () => {
 *   const { isLoading, trigger } = useApi(fetchUsers);
 *   useEffect(() => {
 *     trigger();
 *   }, []);
 *   return <div>{isLoading ? : 'Loading' : 'Done!'}</div>
 * }
 * ```
 */
export function useApi<P = any, A extends ThunkAction = ThunkAction<P>>(
  action: A,
): UseApiAction<A>;
export function useApi<P = any, A extends ThunkAction = ThunkAction<P>>(
  action: ActionFnWithPayload<P>,
): UseApiProps<P>;
export function useApi<A extends ThunkAction = ThunkAction>(
  action: ActionFn,
): UseApiSimpleProps;
export function useApi(action: any): any {
  const dispatch = useDispatch();
  const loader = useLoader(action);
  const trigger = (p: any) => {
    if (typeof action === "function") {
      dispatch(action(p));
    } else {
      dispatch(action);
    }
  };
  return { ...loader, trigger, action };
}

/**
 * useQuery uses {@link useApi} and automatically calls `useApi().trigger()`
 *
 * @example
 * ```ts
 * import { useQuery } from 'starfx/react';
 *
 * import { api } from './api';
 *
 * const fetchUsers = api.get('/users', function*() {
 *   // ...
 * });
 *
 * const View = () => {
 *   const { isLoading } = useQuery(fetchUsers);
 *   return <div>{isLoading ? : 'Loading' : 'Done!'}</div>
 * }
 * ```
 */
export function useQuery<P = any, A extends ThunkAction = ThunkAction<P>>(
  action: A,
): UseApiAction<A> {
  const api = useApi(action);
  useEffect(() => {
    api.trigger();
  }, [action.payload.key]);
  return api;
}

/**
 * useCache uses {@link useQuery} and automatically selects the cached data associated
 * with the action creator or action provided.
 *
 * @example
 * ```ts
 * import { useCache } from 'starfx/react';
 *
 * import { api } from './api';
 *
 * const fetchUsers = api.get('/users', api.cache());
 *
 * const View = () => {
 *   const { isLoading, data } = useCache(fetchUsers());
 *   return <div>{isLoading ? : 'Loading' : data.length}</div>
 * }
 * ```
 */
export function useCache(action: ThunkAction): UseCacheResult<any, ThunkAction>;
export function useCache<
  S extends { cache: TableOutput<any, any>["initialState"] },
  P = any,
  ApiSuccess = any,
>(
  action: ThunkAction<P, ApiSuccess>,
): UseCacheResult<typeof action.payload._result, ThunkAction<P, ApiSuccess>>;
export function useCache(action: any) {
  const schema = useSchemaWithCache();
  const id = action.payload.key;
  const data = useSelector((s: any) => schema.cache.selectById(s, { id }));
  const query = useQuery(action);
  return { ...query, data: (data as any) || null };
}

/**
 * useLoaderSuccess will activate the callback provided when the loader transitions
 * from some state to success.
 *
 * @example
 * ```ts
 * import { useLoaderSuccess, useApi } from 'starfx/react';
 *
 * import { api } from './api';
 *
 * const createUser = api.post('/users', function*(ctx, next) {
 *   // ...
 * });
 *
 * const View = () => {
 *  const { loader, trigger } = useApi(createUser);
 *  const onSubmit = () => {
 *    trigger({ name: 'bob' });
 *  };
 *
 *  useLoaderSuccess(loader, () => {
 *    // success!
 *    // Use this callback to navigate to another view
 *  });
 *
 *  return <button onClick={onSubmit}>Create user!</button>
 * }
 * ```
 */
export function useLoaderSuccess(
  cur: Pick<LoaderState, "status">,
  success: () => any,
) {
  const prev = useRef(cur);
  useEffect(() => {
    if (prev.current.status !== "success" && cur.status === "success") {
      success();
    }
    prev.current = cur;
  }, [cur.status]);
}

interface PersistGateProps {
  children: React.ReactNode;
  loading?: ReactElement;
}

function Loading({ text }: { text: string }) {
  return h("div", null, text);
}

export function PersistGate({
  children,
  loading = h(Loading),
}: PersistGateProps) {
  const schema = useSchemaWithLoaders();
  const ldr = useSelector((s: any) =>
    schema.loaders.selectById(s, { id: PERSIST_LOADER_ID }),
  );

  if (ldr.status === "error") {
    return h("div", null, ldr.message);
  }

  if (ldr.status !== "success") {
    return loading;
  }

  return children;
}
