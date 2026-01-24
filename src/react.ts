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
export interface UseApiAction<
  A extends ThunkAction = ThunkAction,
> extends LoaderState {
  trigger: () => void;
  action: A;
}
export type UseApiResult<P, A extends ThunkAction = ThunkAction> =
  | UseApiProps<P>
  | UseApiSimpleProps
  | UseApiAction<A>;

export interface UseCacheResult<
  D = any,
  A extends ThunkAction = ThunkAction,
> extends UseApiAction<A> {
  data: D | null;
}

const SchemaContext = createContext<FxSchema<any, any> | null>(null);

/**
 * React Provider to wire the `FxStore` and schema into React context.
 *
 * @remarks
 * Wrap your application with this provider to make `useSchema`, `useStore`,
 * and the `react` hooks available to descendants.
 *
 * @param props.store - The `FxStore` instance created by `createStore`.
 * @param props.schema - The `FxSchema` created by `createSchema`.
 * @param props.children - React children.
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
export function useLoader<S extends AnyState>(
  action: ThunkAction | ActionFnWithPayload,
) {
  const schema = useSchema();
  const id = getIdFromAction(action);
  return useSelector((s: S) => schema.loaders.selectById(s, { id }));
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

/**
 * PersistGate delays rendering of `children` until the persistence layer has
 * completed rehydration.
 *
 * @remarks
 * - It selects the loader identified by `PERSIST_LOADER_ID` from the current
 *   schema's `loaders` slice.
 * - While the loader status is not `success`, the `loading` element is
 *   rendered (defaults to a simple `Loading` element).
 * - If the loader reaches `error`, the error message is displayed instead of
 *   children or the loading element.
 *
 * @param props.children - Elements to render once persistence has successfully rehydrated.
 * @param props.loading - Optional element to render while rehydrating.
 *
 * @example
 * ```tsx
 * import { PersistGate } from 'starfx/react';
 *
 * function App() {
 *   return (
 *     <PersistGate loading={<div>Restoring state...</div>}>
 *       <RootApp />
 *     </PersistGate>
 *   );
 * }
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
