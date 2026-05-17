import type { Operation } from "effection";
import React, { type ReactElement } from "react";
import {
  Provider as ReduxProvider,
  useDispatch,
  useSelector as useReduxSelector,
  useStore as useReduxStore,
} from "react-redux";
import { getIdFromAction } from "./action.js";
import type { ThunkAction } from "./query/index.js";
import {
  type AnyFxSchema,
  type DefaultSchemaKey,
  type FxSchema,
  type FxStore,
  PERSIST_LOADER_ID,
  type StoreSchemaRegistry,
} from "./store/index.js";
import type { LoaderOutput } from "./store/slice/loaders.js";
import type { TableOutput } from "./store/slice/table.js";
import type { SchemaMap, SliceFromSchema } from "./store/types.js";
import type { AnyState, LoaderState } from "./types.js";
import type { ActionFn, ActionFnWithPayload } from "./types.js";

export { useDispatch } from "react-redux";
export type { TypedUseSelectorHook } from "react-redux";

const {
  useContext,
  useEffect,
  useRef,
  createContext,
  createElement: h,
} = React;

type WithLoadersMap = SchemaMap & { loaders: (n: string) => LoaderOutput };
type WithCacheMap = SchemaMap & { cache: (n: string) => TableOutput<AnyState> };

export type TypedHooks<O extends SchemaMap> = {
  useSelector: <Selected>(
    selector: (state: SliceFromSchema<O>) => Selected,
    equalityFn?: (left: Selected, right: Selected) => boolean,
  ) => Selected;
  useStore: () => FxStore<O>;
  useSchema: () => FxSchema<O>;
  useSchemaWithLoaders: O extends WithLoadersMap ? () => FxSchema<O> : never;
  useSchemaWithCache: O extends WithCacheMap ? () => FxSchema<O> : never;
  useLoader: O extends WithLoadersMap
    ? <A extends LoaderActionInput = LoaderActionInput>(
        action: A,
      ) => LoaderState
    : never;
  useApi: O extends WithLoadersMap
    ? <A extends ApiActionInput>(action: A) => UseApiReturn<A>
    : never;
  useQuery: O extends WithLoadersMap
    ? <P = unknown, A extends ThunkAction<P> = ThunkAction<P>>(
        action: A,
      ) => UseApiAction<A>
    : never;
  useCache: O extends WithCacheMap
    ? <P = unknown, ApiSuccess = unknown>(
        action: ThunkAction<P, ApiSuccess>,
      ) => UseCacheResult<ApiSuccess, ThunkAction<P, ApiSuccess>>
    : never;
};

export interface UseApiProps<P = unknown> extends LoaderState {
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

type LoaderActionInput = ThunkAction | ActionFn | ActionFnWithPayload<never>;
type ApiActionInput = ThunkAction | ActionFn | ActionFnWithPayload<never>;
type UseApiReturn<A extends ApiActionInput> = A extends ActionFn
  ? UseApiSimpleProps
  : A extends ActionFnWithPayload<infer P>
    ? UseApiProps<P>
    : A extends ThunkAction
      ? UseApiAction<A>
      : never;

type StoreContextValue = ReturnType<
  typeof import("./store/context.js").StoreContext.expect
> extends Operation<infer T>
  ? T
  : never;

const SchemaContext = createContext<unknown>(null);

export function useSelector<Selected = unknown>(
  // biome-ignore lint/suspicious/noExplicitAny: bare global useSelector intentionally opts out of state typing.
  selector: (state: any) => Selected,
  equalityFn?: (left: Selected, right: Selected) => boolean,
): Selected;
export function useSelector<O extends SchemaMap, Selected = unknown>(
  selector: (state: SliceFromSchema<O>) => Selected,
  equalityFn?: (left: Selected, right: Selected) => boolean,
): Selected;
export function useSelector(
  // biome-ignore lint/suspicious/noExplicitAny: implementation signature must be broad enough to cover both typed and untyped overloads.
  selector: (state: any) => unknown,
  equalityFn?: (left: unknown, right: unknown) => boolean,
): unknown {
  return useReduxSelector(
    selector as (state: SliceFromSchema<SchemaMap>) => unknown,
    equalityFn,
  );
}

export function createTypedHooks<O extends SchemaMap>(
  _schema: FxSchema<O>,
): TypedHooks<O> {
  const useTypedSelector: TypedHooks<O>["useSelector"] = (
    selector,
    equalityFn,
  ) => useSelector<O, ReturnType<typeof selector>>(selector, equalityFn);

  return {
    useSelector: useTypedSelector,
    useStore: () => useStore<O>(),
    useSchema: () => useSchema<O>(),
    useSchemaWithLoaders: (() =>
      useSchemaWithLoaders<
        O & WithLoadersMap
      >()) as TypedHooks<O>["useSchemaWithLoaders"],
    useSchemaWithCache: (() =>
      useSchemaWithCache<
        O & WithCacheMap
      >()) as TypedHooks<O>["useSchemaWithCache"],
    useLoader: ((action) =>
      useLoader<O & WithLoadersMap>(action)) as TypedHooks<O>["useLoader"],
    useApi: ((action) =>
      useApi<O & WithLoadersMap>(action)) as TypedHooks<O>["useApi"],
    useQuery: ((action) =>
      useQuery<O & WithLoadersMap>(action)) as TypedHooks<O>["useQuery"],
    useCache: ((action) =>
      useCache<O & WithCacheMap>(action)) as TypedHooks<O>["useCache"],
  };
}

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
export function Provider<
  O extends SchemaMap,
  TSchemas extends StoreSchemaRegistry = StoreSchemaRegistry<FxSchema<O>>,
>(props: {
  store: FxStore<O, TSchemas>;
  schema?: TSchemas[DefaultSchemaKey];
  children?: React.ReactNode;
}): React.ReactElement;

export function Provider(props: {
  store: unknown;
  schema?: unknown;
  children?: React.ReactNode;
}): React.ReactElement {
  const { store, schema, children } = props as {
    store: StoreContextValue;
    schema?: AnyFxSchema;
    children?: React.ReactNode;
  };
  // Use provided schema or pull from store
  const schemaValue = schema ?? store.schema;
  const inner = h(SchemaContext.Provider, { value: schemaValue }, children);
  return h(ReduxProvider, { store, children: inner });
}

export function useSchema<O extends SchemaMap = SchemaMap>(): FxSchema<O> {
  const ctx = useContext(SchemaContext);
  if (!ctx) throw new Error("No Schema available in context");
  return ctx as FxSchema<O>;
}

// Typed variant for schemas that include `loaders`.
export function useSchemaWithLoaders<
  O extends WithLoadersMap = WithLoadersMap,
>(): FxSchema<O> {
  const ctx = useContext(SchemaContext);
  if (!ctx) throw new Error("No Schema available in context");
  return ctx as FxSchema<O>;
}

// Typed variant for schemas that include `cache`.
export function useSchemaWithCache<
  O extends WithCacheMap = WithCacheMap,
>(): FxSchema<O> {
  const ctx = useContext(SchemaContext);
  if (!ctx) throw new Error("No Schema available in context");
  return ctx as FxSchema<O>;
}

export function useStore<O extends SchemaMap>() {
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
export function useLoader<
  O extends WithLoadersMap = WithLoadersMap,
  A extends LoaderActionInput = LoaderActionInput,
>(action: A): LoaderState {
  const schema = useSchemaWithLoaders<O>();
  const id = getIdFromAction(action);
  type LoaderSelectState = Parameters<typeof schema.loaders.selectById>[0];
  return useSelector<O, LoaderState>((s) =>
    schema.loaders.selectById(s as unknown as LoaderSelectState, { id }),
  );
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
export function useApi<
  O extends WithLoadersMap = WithLoadersMap,
  A extends ApiActionInput = ApiActionInput,
>(action: A): UseApiReturn<A> {
  const dispatch = useDispatch();
  const loader = useLoader<O>(action);
  const trigger = (p?: unknown) => {
    if (typeof action === "function") {
      dispatch((action as ActionFnWithPayload<unknown>)(p));
    } else {
      dispatch(action);
    }
  };
  return { ...loader, trigger, action } as UseApiReturn<A>;
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
export function useQuery<
  O extends WithLoadersMap = WithLoadersMap,
  A extends ThunkAction = ThunkAction,
>(action: A): UseApiAction<A> {
  const api = useApi<O, A>(action) as UseApiAction<A>;
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
export function useCache<
  O extends WithCacheMap = WithCacheMap,
  P = unknown,
  ApiSuccess = unknown,
>(
  action: ThunkAction<P, ApiSuccess>,
): UseCacheResult<ApiSuccess, ThunkAction<P, ApiSuccess>> {
  const schema = useSchemaWithCache<O>();
  const id = action.payload.key;
  type CacheSelectState = Parameters<typeof schema.cache.selectById>[0];
  const data = useSelector<O, unknown>((s) =>
    schema.cache.selectById(s as unknown as CacheSelectState, { id }),
  );
  const query = useQuery(action);
  return { ...query, data: (data as ApiSuccess | undefined) ?? null };
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
  success: () => void,
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
  type LoaderSelectState = Parameters<typeof schema.loaders.selectById>[0];
  const ldr = useSelector<WithLoadersMap, LoaderState>((s) =>
    schema.loaders.selectById(s as unknown as LoaderSelectState, {
      id: PERSIST_LOADER_ID,
    }),
  );

  if (ldr.status === "error") {
    return h("div", null, ldr.message);
  }

  if (ldr.status !== "success") {
    return loading;
  }

  return children;
}
