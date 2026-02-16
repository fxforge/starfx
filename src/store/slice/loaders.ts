import { createSelector } from "reselect";
import type {
  AnyState,
  LoaderItemState,
  LoaderPayload,
  LoaderState,
} from "../../types.js";
import type { BaseSchema } from "../types.js";

interface PropId {
  id: string;
}

interface PropIds {
  ids: string[];
}

const excludesFalse = <T>(n?: T): n is T => Boolean(n);

/**
 * Create a default loader item with sensible defaults.
 *
 * @remarks
 * Returns a complete {@link LoaderItemState} with the following defaults:
 * - `id`: empty string
 * - `status`: 'idle'
 * - `message`: empty string
 * - `lastRun`: 0 (never run)
 * - `lastSuccess`: 0 (never succeeded)
 * - `meta`: empty object
 *
 * @typeParam M - Metadata shape stored on the loader.
 * @param li - Partial fields to override the defaults.
 * @returns A fully populated {@link LoaderItemState}.
 *
 * @example
 * ```ts
 * const loader = defaultLoaderItem({ id: 'fetch-users' });
 * // { id: 'fetch-users', status: 'idle', message: '', ... }
 * ```
 */
export function defaultLoaderItem<M extends AnyState = AnyState>(
  li: Partial<LoaderItemState<M>> = {},
): LoaderItemState<M> {
  return {
    id: "",
    status: "idle",
    message: "",
    lastRun: 0,
    lastSuccess: 0,
    meta: {} as M,
    ...li,
  };
}

/**
 * Create a loader state with computed helper booleans.
 *
 * @remarks
 * Extends {@link defaultLoaderItem} with convenience boolean properties:
 * - `isIdle` - status === 'idle'
 * - `isLoading` - status === 'loading'
 * - `isSuccess` - status === 'success'
 * - `isError` - status === 'error'
 * - `isInitialLoading` - loading AND never succeeded (`lastSuccess === 0`)
 *
 * The `isInitialLoading` distinction is important: if data was successfully
 * loaded before, showing a loading spinner on re-fetch may not be necessary.
 * This lets you show stale data while refreshing.
 *
 * @typeParam M - Metadata shape stored on the loader.
 * @param l - Partial loader fields to normalize.
 * @returns A {@link LoaderState} with helper booleans.
 *
 * @example
 * ```ts
 * const loader = defaultLoader({ status: 'loading', lastSuccess: 0 });
 * loader.isLoading;        // true
 * loader.isInitialLoading; // true (first load)
 *
 * const reloader = defaultLoader({ status: 'loading', lastSuccess: Date.now() });
 * reloader.isLoading;        // true
 * reloader.isInitialLoading; // false (has succeeded before)
 * ```
 */
export function defaultLoader<M extends AnyState = AnyState>(
  l: Partial<LoaderItemState<M>> = {},
): LoaderState<M> {
  const loading = defaultLoaderItem(l);
  return {
    ...loading,
    isIdle: loading.status === "idle",
    isError: loading.status === "error",
    isSuccess: loading.status === "success",
    isLoading: loading.status === "loading",
    isInitialLoading:
      (loading.status === "idle" || loading.status === "loading") &&
      loading.lastSuccess === 0,
  };
}

interface LoaderSelectors<
  M extends AnyState = AnyState,
  S extends AnyState = AnyState,
> {
  findById: (
    d: Record<string, LoaderItemState<M>>,
    { id }: PropId,
  ) => LoaderState<M>;
  findByIds: (
    d: Record<string, LoaderItemState<M>>,
    { ids }: PropIds,
  ) => LoaderState<M>[];
  selectTable: (s: S) => Record<string, LoaderItemState<M>>;
  selectTableAsList: (state: S) => LoaderItemState<M>[];
  selectById: (s: S, p: PropId) => LoaderState<M>;
  selectByIds: (s: S, p: PropIds) => LoaderState<M>[];
}

function loaderSelectors<
  M extends AnyState = AnyState,
  S extends AnyState = AnyState,
>(
  selectTable: (s: S) => Record<string, LoaderItemState<M>>,
): LoaderSelectors<M, S> {
  const empty = defaultLoader();
  const tableAsList = (
    data: Record<string, LoaderItemState<M>>,
  ): LoaderItemState<M>[] => Object.values(data).filter(excludesFalse);

  const findById = (data: Record<string, LoaderItemState<M>>, { id }: PropId) =>
    defaultLoader<M>(data[id]) || empty;
  const findByIds = (
    data: Record<string, LoaderItemState<M>>,
    { ids }: PropIds,
  ): LoaderState<M>[] =>
    ids.map((id) => defaultLoader<M>(data[id])).filter(excludesFalse);
  const selectById = createSelector(
    selectTable,
    (_: S, p: PropId) => p.id,
    (loaders, id): LoaderState<M> => findById(loaders, { id }),
  );

  return {
    findById,
    findByIds,
    selectTable,
    selectTableAsList: createSelector(
      selectTable,
      (data): LoaderItemState<M>[] => tableAsList(data),
    ),
    selectById,
    selectByIds: createSelector(
      selectTable,
      (_: S, p: PropIds) => p.ids,
      (loaders, ids) => findByIds(loaders, { ids }),
    ),
  };
}

export interface LoaderOutput<
  M extends Record<string, unknown>,
  S extends AnyState,
> extends LoaderSelectors<M, S>,
    BaseSchema<Record<string, LoaderItemState<M>>> {
  schema: "loader";
  initialState: Record<string, LoaderItemState<M>>;
  start: (e: LoaderPayload<M>) => (s: S) => void;
  success: (e: LoaderPayload<M>) => (s: S) => void;
  error: (e: LoaderPayload<M>) => (s: S) => void;
  reset: () => (s: S) => void;
  resetByIds: (ids: string[]) => (s: S) => void;
}

const ts = () => new Date().getTime();

/**
 * Create a loader slice for tracking async loader state keyed by id.
 *
 * @typeParam M - Metadata shape stored on loader entries.
 * @typeParam S - Root state shape.
 * @param param0.name - The slice name to attach to the state.
 * @param param0.initialState - Optional initial loader table.
 * @returns A `LoaderOutput` exposing selectors and mutation helpers.
 */
export const createLoaders = <
  M extends AnyState = AnyState,
  S extends AnyState = AnyState,
>({
  name,
  initialState = {},
}: {
  name: keyof S;
  initialState?: Record<string, LoaderItemState<M>>;
}): LoaderOutput<M, S> => {
  const selectors = loaderSelectors<M, S>((s: S) => s[name]);

  return {
    schema: "loader",
    name: name as string,
    initialState,
    start: (e) => (s) => {
      const table = selectors.selectTable(s);
      const loader = table[e.id];
      table[e.id] = defaultLoaderItem({
        ...loader,
        ...e,
        status: "loading",
        lastRun: ts(),
      });
    },
    success: (e) => (s) => {
      const table = selectors.selectTable(s);
      const loader = table[e.id];
      table[e.id] = defaultLoaderItem({
        ...loader,
        ...e,
        status: "success",
        lastSuccess: ts(),
      });
    },
    error: (e) => (s) => {
      const table = selectors.selectTable(s);
      const loader = table[e.id];
      table[e.id] = defaultLoaderItem({
        ...loader,
        ...e,
        status: "error",
      });
    },
    reset: () => (s) => {
      (s as any)[name] = initialState;
    },
    resetByIds: (ids: string[]) => (s) => {
      const table = selectors.selectTable(s);
      ids.forEach((id) => {
        delete table[id];
      });
    },
    ...selectors,
  };
};

/**
 * Shortcut for declaring loader slices in schema definitions.
 *
 * @param initialState - Optional initial loader table.
 */
export function loaders<M extends AnyState = AnyState>(
  initialState?: Record<string, LoaderItemState<M>>,
) {
  return (name: string) => createLoaders<M>({ name, initialState });
}
