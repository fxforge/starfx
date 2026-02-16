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

const SchemaContext = createContext<FxSchema<any, any> | null>(null);

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
 * @param props.schema - The schema created by {@link createSchema}.
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
export function Provider({
  store,
  schema,
  children,
}: {
  store: FxStore<any>;
  schema: FxSchema<any, any>;
  children: React.ReactNode;
}) {
  return h(ReduxProvider, {
    store,
    children: h(SchemaContext.Provider, { value: schema, children }) as any,
  });
}

export function useSchema<S extends AnyState>() {
  return useContext(SchemaContext) as FxSchema<S>;
}

export function useStore<S extends AnyState>() {
  return useReduxStore() as FxStore<S>;
}

/**
 * Get the loader state for an action creator or action.
 *
 * @remarks
 * Loaders track the lifecycle of thunks and endpoints (idle, loading, success, error).
 * This hook subscribes to the loader state and triggers re-renders when it changes.
 *
 * The returned {@link LoaderState} includes convenience booleans:
 * - `isIdle` - Initial state, never run
 * - `isLoading` - Currently executing
 * - `isSuccess` - Completed successfully
 * - `isError` - Completed with an error
 * - `isInitialLoading` - Loading AND never succeeded before
 *
 * @typeParam S - The state shape (inferred from schema).
 * @param action - The action creator or dispatched action to track.
 * @returns The {@link LoaderState} for the action.
 *
 * @see {@link useApi} for combining loader with trigger function.
 * @see {@link useQuery} for auto-triggering on mount.
 *
 * @example With action creator
 * ```tsx
 * import { useLoader } from 'starfx/react';
 *
 * function UserStatus() {
 *   const loader = useLoader(fetchUsers());
 *
 *   if (loader.isLoading) return <Spinner />;
 *   if (loader.isError) return <Error message={loader.message} />;
 *   return <div>Users loaded!</div>;
 * }
 * ```
 *
 * @example With dispatched action (tracks specific call)
 * ```tsx
 * function UserDetail({ id }: { id: string }) {
 *   const loader = useLoader(fetchUser({ id }));
 *   // Tracks this specific fetchUser call by its payload
 * }
 * ```
 */
export function useLoader<S extends AnyState>(
  action: ThunkAction | ActionFnWithPayload,
) {
  const schema = useSchema();
  const id = getIdFromAction(action);
  return useSelector((s: S) => schema.loaders.selectById(s, { id }));
}

/**
 * Get loader state and a trigger function for an action.
 *
 * @remarks
 * Combines {@link useLoader} with a `trigger` function for dispatching the action.
 * Does NOT automatically fetch data - use `trigger()` to initiate the request.
 *
 * For automatic fetching on mount, use {@link useQuery} instead.
 *
 * @typeParam P - The payload type for the action.
 * @typeParam A - The action type.
 * @param action - The action creator or dispatched action.
 * @returns An object with loader state and `trigger` function.
 *
 * @see {@link useQuery} for auto-triggering on mount.
 * @see {@link useCache} for auto-triggering with cached data.
 * @see {@link useLoaderSuccess} for success callbacks.
 *
 * @example Manual trigger
 * ```tsx
 * import { useApi } from 'starfx/react';
 *
 * function CreateUserForm() {
 *   const { isLoading, trigger } = useApi(createUser);
 *
 *   const handleSubmit = (data: FormData) => {
 *     trigger({ name: data.get('name') });
 *   };
 *
 *   return (
 *     <form onSubmit={handleSubmit}>
 *       <input name="name" />
 *       <button disabled={isLoading}>
 *         {isLoading ? 'Creating...' : 'Create User'}
 *       </button>
 *     </form>
 *   );
 * }
 * ```
 *
 * @example Fetch on mount with useEffect
 * ```tsx
 * function UsersList() {
 *   const { isLoading, trigger } = useApi(fetchUsers);
 *
 *   useEffect(() => {
 *     trigger();
 *   }, []);
 *
 *   return isLoading ? <Spinner /> : <Users />;
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
 * Auto-triggering version of {@link useApi}.
 *
 * @remarks
 * Automatically dispatches the action on mount and when the action's `key` changes.
 * This is useful for "fetch on render" patterns.
 *
 * The action is re-triggered when `action.payload.key` changes, which is a hash
 * of the action name and payload. This means changing the payload (e.g., a user ID)
 * will trigger a new fetch.
 *
 * @typeParam P - The payload type for the action.
 * @typeParam A - The action type.
 * @param action - The dispatched action to execute.
 * @returns An object with loader state and `trigger` function.
 *
 * @see {@link useApi} for manual triggering.
 * @see {@link useCache} for auto-triggering with cached data.
 *
 * @example Basic usage
 * ```tsx
 * import { useQuery } from 'starfx/react';
 *
 * function UsersList() {
 *   const { isLoading, isError, message } = useQuery(fetchUsers);
 *
 *   if (isLoading) return <Spinner />;
 *   if (isError) return <Error message={message} />;
 *   return <Users />;
 * }
 * ```
 *
 * @example With parameters (re-fetches on change)
 * ```tsx
 * function UserDetail({ userId }: { userId: string }) {
 *   // Re-fetches when userId changes
 *   const { isLoading } = useQuery(fetchUser({ id: userId }));
 *   // ...
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
 * Auto-fetch with cached data selection.
 *
 * @remarks
 * Combines {@link useQuery} with automatic selection of cached response data.
 * The endpoint must use `api.cache()` middleware to populate the cache.
 *
 * This is the most convenient hook for "fetch and display" patterns where
 * you want the raw API response data.
 *
 * @typeParam P - The payload type for the action.
 * @typeParam ApiSuccess - The expected success response type.
 * @param action - The dispatched action with cache enabled.
 * @returns An object with loader state, `trigger` function, and `data`.
 *
 * @see {@link useQuery} for queries without cache selection.
 * @see {@link useApi} for manual triggering.
 *
 * @example Basic usage
 * ```tsx
 * import { useCache } from 'starfx/react';
 *
 * // Endpoint with caching enabled
 * const fetchUsers = api.get<never, User[]>('/users', api.cache());
 *
 * function UsersList() {
 *   const { isLoading, data } = useCache(fetchUsers());
 *
 *   if (isLoading && !data) return <Spinner />;
 *
 *   return (
 *     <ul>
 *       {data?.map(user => (
 *         <li key={user.id}>{user.name}</li>
 *       ))}
 *     </ul>
 *   );
 * }
 * ```
 *
 * @example With typed response
 * ```tsx
 * interface User {
 *   id: string;
 *   name: string;
 *   email: string;
 * }
 *
 * const fetchUser = api.get<{ id: string }, User>('/users/:id', api.cache());
 *
 * function UserProfile({ id }: { id: string }) {
 *   const { data, isError, message } = useCache(fetchUser({ id }));
 *   // data is typed as User | null
 * }
 * ```
 */
export function useCache<P = any, ApiSuccess = any>(
  action: ThunkAction<P, ApiSuccess>,
): UseCacheResult<typeof action.payload._result, ThunkAction<P, ApiSuccess>> {
  const schema = useSchema();
  const id = action.payload.key;
  const data: any = useSelector((s: any) => schema.cache.selectById(s, { id }));
  const query = useQuery(action);
  return { ...query, data: data || null };
}

/**
 * Execute a callback when a loader transitions to success state.
 *
 * @remarks
 * Watches the loader's status and fires the callback when it changes from
 * any non-success state to "success". Useful for side effects like navigation,
 * showing toasts, or resetting forms after successful operations.
 *
 * @param cur - The loader state to watch (from {@link useLoader} or {@link useApi}).
 * @param success - Callback to execute on success transition.
 *
 * @example Navigate after form submission
 * ```tsx
 * import { useApi, useLoaderSuccess } from 'starfx/react';
 * import { useNavigate } from 'react-router-dom';
 *
 * function CreateUserForm() {
 *   const navigate = useNavigate();
 *   const { trigger, ...loader } = useApi(createUser);
 *
 *   useLoaderSuccess(loader, () => {
 *     // Navigate to user list after successful creation
 *     navigate('/users');
 *   });
 *
 *   const handleSubmit = (data: FormData) => {
 *     trigger({ name: data.get('name') });
 *   };
 *
 *   return <form onSubmit={handleSubmit}>...</form>;
 * }
 * ```
 *
 * @example Show success toast
 * ```tsx
 * function DeleteButton({ id }: { id: string }) {
 *   const { trigger, ...loader } = useApi(deleteUser);
 *
 *   useLoaderSuccess(loader, () => {
 *     toast.success('User deleted successfully');
 *   });
 *
 *   return <button onClick={() => trigger({ id })}>Delete</button>;
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

/**
 * Delay rendering until persistence rehydration completes.
 *
 * @remarks
 * When using state persistence, the store needs to be rehydrated from storage
 * before rendering the app. This component shows a loading state until the
 * persistence loader (identified by `PERSIST_LOADER_ID`) reaches success.
 *
 * If rehydration fails, the error message is displayed.
 *
 * @param props - Component props.
 * @param props.children - Elements to render after successful rehydration.
 * @param props.loading - Optional element to show while rehydrating (default: "Loading").
 *
 * @see {@link createPersistor} for setting up persistence.
 * @see {@link PERSIST_LOADER_ID} for the internal loader ID.
 *
 * @example Basic usage
 * ```tsx
 * import { PersistGate, Provider } from 'starfx/react';
 *
 * function App() {
 *   return (
 *     <Provider store={store} schema={schema}>
 *       <PersistGate loading={<SplashScreen />}>
 *         <Router>
 *           <Routes />
 *         </Router>
 *       </PersistGate>
 *     </Provider>
 *   );
 * }
 * ```
 *
 * @example Custom loading component
 * ```tsx
 * function CustomLoader() {
 *   return (
 *     <div className="splash">
 *       <Spinner />
 *       <p>Restoring your session...</p>
 *     </div>
 *   );
 * }
 *
 * <PersistGate loading={<CustomLoader />}>
 *   <App />
 * </PersistGate>
 * ```
 */
export function PersistGate({
  children,
  loading = h(Loading),
}: PersistGateProps) {
  const schema = useSchema();
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
