import type { Draft, Immutable } from "immer";
import { createSelector } from "reselect";
import type {
  LoaderItemState,
  LoaderPayload,
  LoaderState,
} from "../../types.js";
import type { BaseSchema, SliceState } from "../types.js";

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
 * Returns a complete LoaderItemState with these defaults:
 * - `id`: empty string
 * - `status`: `idle`
 * - `message`: empty string
 * - `lastRun`: 0
 * - `lastSuccess`: 0
 * - `meta`: empty object
 *
 * @param li - Partial fields to override defaults.
 * @returns A fully populated loader item.
 *
 * @example
 * ```ts
 * const loader = defaultLoaderItem({ id: "fetch-users" });
 * ```
 */
export function defaultLoaderItem(
  li: Partial<LoaderItemState> = {},
): LoaderItemState {
  return {
    id: "",
    status: "idle",
    message: "",
    lastRun: 0,
    lastSuccess: 0,
    meta: {},
    ...li,
  };
}

/**
 * Create a loader state with computed helper booleans.
 *
 * @remarks
 * Extends `defaultLoaderItem` with convenience booleans:
 * - `isIdle`
 * - `isLoading`
 * - `isSuccess`
 * - `isError`
 * - `isInitialLoading` (loading and never succeeded)
 *
 * @param l - Partial loader fields to normalize.
 * @returns A loader state with helper booleans.
 *
 * @example
 * ```ts
 * const loader = defaultLoader({ status: "loading", lastSuccess: 0 });
 * loader.isInitialLoading; // true
 * ```
 */
export function defaultLoader(l: Partial<LoaderItemState> = {}): LoaderState {
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
type LoaderTable = Record<string, LoaderItemState>;

export interface LoaderSelectors {
  findById: (d: Immutable<LoaderTable>, p: PropId) => LoaderState;
  findByIds: (d: Immutable<LoaderTable>, p: PropIds) => LoaderState[];
  selectTable: (
    s: Immutable<SliceState<LoaderTable>>,
  ) => Immutable<LoaderTable>;
  selectTableAsList: (
    state: Immutable<SliceState<LoaderTable>>,
  ) => LoaderItemState[];
  selectById: (s: Immutable<SliceState<LoaderTable>>, p: PropId) => LoaderState;
  selectByIds: (
    s: Immutable<SliceState<LoaderTable>>,
    p: PropIds,
  ) => LoaderState[];
}

function loaderSelectors(selectTable: LoaderSelectors["selectTable"]) {
  const findById = ((data, { id }) =>
    defaultLoader(data[id])) satisfies LoaderSelectors["findById"];

  const findByIds = ((data, { ids }) =>
    ids
      .map((id) => defaultLoader(data[id]))
      .filter(excludesFalse)) satisfies LoaderSelectors["findByIds"];

  const selectors = {
    findById,
    findByIds,
    selectTable,
    selectTableAsList: createSelector([selectTable], (data) =>
      Object.values(data).filter(excludesFalse),
    ),
    selectById: createSelector(
      [selectTable, (_, p: PropId) => p.id],
      (data, id) => findById(data, { id }),
    ),
    selectByIds: createSelector(
      [selectTable, (_, p: PropIds) => p.ids],
      (data, ids) => findByIds(data, { ids }),
    ),
  } satisfies LoaderSelectors;

  return selectors;
}

export interface LoaderActions {
  start: (e: LoaderPayload) => (s: Draft<SliceState<LoaderTable>>) => void;
  success: (e: LoaderPayload) => (s: Draft<SliceState<LoaderTable>>) => void;
  error: (e: LoaderPayload) => (s: Draft<SliceState<LoaderTable>>) => void;
  reset: () => (s: Draft<SliceState<LoaderTable>>) => void;
  resetByIds: (ids: string[]) => (s: Draft<SliceState<LoaderTable>>) => void;
}

export interface LoaderOutput
  extends BaseSchema<LoaderTable>,
    LoaderActions,
    LoaderSelectors {
  schema: "loader";
  initialState: LoaderTable;
}

const ts = () => new Date().getTime();

export const createLoaders = ({
  name,
  initialState = {},
}: {
  name: keyof SliceState<LoaderTable>;
  initialState?: LoaderTable;
}): LoaderOutput => {
  const loaderInitialState = initialState ?? {};
  const selectors = loaderSelectors((s) => s[name]);

  const output = {
    schema: "loader",
    name,
    initialState: loaderInitialState,
    start: (e) => (s) => {
      const table = s[name];
      const loader = table[e.id];
      table[e.id] = defaultLoaderItem({
        ...loader,
        ...e,
        status: "loading",
        lastRun: ts(),
      });
    },
    success: (e) => (s) => {
      const table = s[name];
      const loader = table[e.id];
      table[e.id] = defaultLoaderItem({
        ...loader,
        ...e,
        status: "success",
        lastSuccess: ts(),
      });
    },
    error: (e) => (s) => {
      const table = s[name];
      const loader = table[e.id];
      table[e.id] = defaultLoaderItem({
        ...loader,
        ...e,
        status: "error",
      });
    },
    reset: () => (s) => {
      const table = s[name];
      for (const key of Object.keys(table)) delete table[key];
      Object.assign(table, loaderInitialState);
    },
    resetByIds: (ids: string[]) => (s) => {
      const table = s[name];
      ids.forEach((id) => {
        delete table[id];
      });
    },
    ...selectors,
  } satisfies LoaderOutput;

  return output;
};

/**
 * Public loader slice API used in `createSchema` definitions.
 *
 * @remarks
 * Tracks async lifecycle status for thunks/endpoints and exposes:
 * - updaters: `start`, `success`, `error`, `reset`, `resetByIds`
 * - selectors: `selectById`, `selectByIds`, `selectTable`, `selectTableAsList`
 *
 * @param initialState - Optional initial loader table.
 * @returns A factory consumed by `createSchema` with the slice name.
 *
 * @example
 * ```ts
 * const schema = createSchema({
 *   loaders: slice.loaders(),
 * });
 * ```
 */
export function loaders(initialState?: Record<string, LoaderItemState>) {
  return (name: string) => createLoaders({ name, initialState });
}
