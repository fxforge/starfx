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
import type { LoaderState } from "./types.js";
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

type WithLoadersMap = FxMap & { loaders: (n: string) => LoaderOutput };
type WithCacheMap = FxMap & { cache: (n: string) => TableOutput<any> };

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

export interface UseCacheResult<D, A extends ThunkAction = ThunkAction>
  extends UseApiAction<A> {
  data: D | null;
}

const SchemaContext = createContext<FxSchema<FxMap> | null>(null);

/**
 * React Provider to wire the `FxStore` and schema into React context.
 *
 * @remarks
 * Wrap your application with this provider to make hooks like
 * {@link useSchema}, {@link useStore}, {@link useLoader}, {@link useApi},
 * {@link useQuery}, and {@link useCache} available to all descendants.
 *
 * This provider integrates with react-redux internally, so standard Redux
 * DevTools will work with your starfx store.
 *
 * @param props - Provider props.
 * @param props.store - The {@link FxStore} instance created by {@link createStore}.
 * @param props.schema - Optional schema created by {@link createSchema}; defaults to `store.schema`.
 * @param props.children - React children to render.
 *
 * @see {@link createStore} for creating the store.
 * @see {@link createSchema} for creating the schema.
 *
 * @example
 * ```tsx
 * import { Provider } from 'starfx/react';
 * import { store, schema } from './store';
 *
 * function App() {
 *   return (
 *     <Provider store={store} schema={schema}>
 *       <MyApp />
 *     </Provider>
 *   );
 * }
 * ```
 */
export function Provider<O extends FxMap>(props: {
  store: FxStore<O>;
  schema?: FxSchema<O>;
  children?: React.ReactNode;
}): React.ReactElement;

export function Provider(props: {
  store: FxStore<FxMap>;
  schema?: FxSchema<FxMap>;
  children?: React.ReactNode;
}): React.ReactElement;

export function Provider(props: {
  store: FxStore<FxMap>;
  schema?: FxSchema<FxMap>;
  children?: React.ReactNode;
}) {
  const { store, schema, children } = props;
  // Use provided schema or pull from store
  const schemaValue = (schema ?? store.schema) as FxSchema<FxMap>;
  const inner = h(SchemaContext.Provider, { value: schemaValue }, children);
  return h(ReduxProvider, { store, children: inner });
}

export function useSchema<O extends FxMap>() {
  const ctx = useContext(SchemaContext);
  if (!ctx) throw new Error("No Schema available in context");
  return ctx as FxSchema<O>;
}

// Typed variant for schemas that include `loaders`.
export function useSchemaWithLoaders(): FxSchema<WithLoadersMap>;
export function useSchemaWithLoaders<O extends WithLoadersMap>(): FxSchema<O>;
export function useSchemaWithLoaders() {
  const ctx = useContext(SchemaContext);
  if (!ctx) throw new Error("No Schema available in context");
  return ctx as FxSchema<WithLoadersMap>;
}

// Typed variant for schemas that include `cache`.
export function useSchemaWithCache(): FxSchema<WithCacheMap>;
export function useSchemaWithCache<O extends WithCacheMap>(): FxSchema<O>;
export function useSchemaWithCache() {
  const ctx = useContext(SchemaContext);
  if (!ctx) throw new Error("No Schema available in context");
  return ctx as FxSchema<WithCacheMap>;
}

export function useStore<O extends FxMap>() {
  return useReduxStore() as FxStore<O>;
}

/**
 * Get the loader state for an action creator or action.
 *
 * @remarks
 * Loaders track the lifecycle of thunks and endpoints (idle, loading, success, error).
 * This hook subscribes to loader state and triggers re-renders when it changes.
 *
 * The returned {@link LoaderState} includes convenience booleans:
 * - `isIdle` - Initial state, never run
 * - `isLoading` - Currently executing
 * - `isSuccess` - Completed successfully
 * - `isError` - Completed with an error
 * - `isInitialLoading` - Loading AND never succeeded before
 *
 * @typeParam O - Schema map constrained to include `loaders`.
 * @param action - The action creator or dispatched action to track.
 * @returns The loader state for the action.
 *
 * @see {@link useApi} for combining loader with trigger function.
 * @see {@link useQuery} for auto-triggering on mount.
 *
 * @example
 * ```tsx
 * function UserStatus() {
 *   const loader = useLoader(fetchUsers());
 *
 *   if (loader.isLoading) return <Spinner />;
 *   if (loader.isError) return <Error message={loader.message} />;
 *   return <div>Users loaded!</div>;
 * }
 * ```
 */
export function useLoader(
  action: ThunkAction | ActionFnWithPayload<any>,
): LoaderState;
export function useLoader<O extends WithLoadersMap>(
  action: ThunkAction | ActionFnWithPayload<any>,
): LoaderState;
export function useLoader(action: any) {
  const schema = useSchemaWithLoaders();
  const id = getIdFromAction(action);
  return useSelector((s: any) => schema.loaders.selectById(s, { id }));
}

/**
 * Get loader state and a trigger function for an action.
 *
 * @remarks
 * Combines {@link useLoader} with a `trigger` function for dispatching the action.
 * Does not automatically fetch data - use `trigger()` to initiate execution.
 *
 * For automatic fetching on mount, use {@link useQuery}.
 *
 * @typeParam P - Payload type for action creators.
 * @typeParam A - Thunk/action type.
 * @param action - The action creator or dispatched action.
 * @returns An object with loader state and trigger function.
 *
 * @see {@link useQuery} for auto-triggering on mount.
 * @see {@link useCache} for auto-triggering with cached data.
 *
 * @example
 * ```tsx
 * function CreateUserForm() {
 *   const { isLoading, trigger } = useApi(createUser);
 *
 *   const handleSubmit = (name: string) => {
 *     trigger({ name });
 *   };
 *
 *   return <button onClick={() => handleSubmit("bob")}>{isLoading ? "Creating..." : "Create"}</button>;
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
 * Auto-triggering variant of {@link useApi}.
 *
 * @remarks
 * Automatically dispatches the action on mount and when `action.payload.key`
 * changes. Useful for fetch-on-render patterns.
 *
 * @param action - The dispatched action to execute.
 * @returns Loader state and trigger function.
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
 * Auto-fetch with cached data selection.
 *
 * @remarks
 * Combines {@link useQuery} with automatic selection of cached response data.
 * The endpoint must use cache middleware to populate the cache table.
 *
 * @param action - Dispatched action with cache enabled.
 * @returns Loader state, trigger function, and selected cache data.
 *
 * @example
 * ```ts
 * const { isLoading, data } = useCache(fetchUsers());
 * if (isLoading && !data) return <Spinner />;
 * return <Users users={data || []} />;
 * ```
 */
export function useCache(action: ThunkAction): UseCacheResult<any, ThunkAction>;
export function useCache<
  S extends { cache: TableOutput<any>["initialState"] },
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
 * Execute a callback when a loader transitions to success.
 *
 * @remarks
 * Watches the loader status and fires the callback when it changes from any
 * non-success state to `success`.
 *
 * @param cur - Loader state to watch.
 * @param success - Callback to execute on success transition.
 *
 * @example
 * ```ts
 * useLoaderSuccess(loader, () => {
 *   navigate('/users');
 * });
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

/**
 * Delay rendering until persistence rehydration completes.
 *
 * @remarks
 * Displays a loading view until the loader identified by `PERSIST_LOADER_ID`
 * reaches success.
 */
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
