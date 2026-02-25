import type { Draft, Immutable } from "immer";
import { createSelector } from "reselect";
import type { IdProp } from "../../types.js";
import type { BaseSchema, SliceState } from "../types.js";

type TableData<Entity> = Record<IdProp, Entity>;
type TableRootState<Entity> = Record<string, TableData<Entity>>;
type TableState<Entity> = Immutable<TableRootState<Entity>>;
type TableDraftState<Entity> = Draft<TableRootState<Entity>>;

interface PropId {
  id: IdProp;
}

interface PropIds {
  ids: IdProp[];
}

interface PatchEntity<T> {
  [key: string]: Partial<T[keyof T]>;
}

const excludesFalse = <T>(n?: T): n is T => Boolean(n);
type EntityOrFactory<Entity> = Entity | (() => Entity);
const isFactory = <T>(value: T | (() => T)): value is () => T =>
  typeof value === "function";
const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object";

export interface TableSelectors<
  Entity = unknown,
  Empty extends EntityOrFactory<Entity> = EntityOrFactory<Entity>,
> {
  findById: (
    d: Immutable<TableData<Entity>>,
    p: PropId,
  ) => Immutable<Entity> | undefined;
  findByIds: (
    d: Immutable<TableData<Entity>>,
    p: PropIds,
  ) => Immutable<Entity>[];
  tableAsList: (d: Immutable<TableData<Entity>>) => Immutable<Entity>[];
  selectTable: (s: TableState<Entity>) => Immutable<TableData<Entity>>;
  selectTableAsList: (state: TableState<Entity>) => Immutable<Entity[]>;
  selectById: (
    s: TableState<Entity>,
    p: PropId,
  ) => Empty extends undefined
    ? Immutable<Entity> | undefined
    : Immutable<Entity>;
  selectByIds: (s: TableState<Entity>, p: PropIds) => Immutable<Entity[]>;
}

function tableSelectors<
  Entity = unknown,
  Empty extends EntityOrFactory<Entity> | undefined = EntityOrFactory<Entity>,
>(
  selectTable: (s: TableState<Entity>) => Immutable<TableData<Entity>>,
  empty: Empty,
) {
  const tableAsList = ((data) =>
    Object.values(data).filter(
      excludesFalse,
    )) satisfies TableSelectors<Entity>["tableAsList"];
  const findById = ((data, { id }) =>
    data[id]) satisfies TableSelectors<Entity>["findById"];
  const findByIds = ((data, { ids }) =>
    ids
      .map((id) => data[id])
      .filter(excludesFalse)) satisfies TableSelectors<Entity>["findByIds"];

  const selectById = ((state, { id }) => {
    const data = selectTable(state);
    return findById(data, { id });
  }) satisfies TableSelectors<Entity>["selectById"];

  return {
    findById,
    findByIds,
    tableAsList,
    selectTable,
    selectTableAsList: createSelector(selectTable, (data) => tableAsList(data)),
    selectById: !empty
      ? selectById
      : (state, { id }) => {
          if (isFactory(empty)) {
            return selectById(state, { id }) || (empty() as Immutable<Entity>);
          }
          return selectById(state, { id }) || (empty as Immutable<Entity>);
        },
    selectByIds: createSelector(
      selectTable,
      (_, p: PropIds) => p.ids,
      (data, ids) => findByIds(data, { ids }),
    ),
  } satisfies TableSelectors<Entity>;
}

export interface TableActions<Entity = unknown> {
  // actions operate on Draft<TableRootState>
  add: (e: SliceState<Entity>) => (s: TableDraftState<Entity>) => void;
  set: (e: SliceState<Entity>) => (s: TableDraftState<Entity>) => void;
  remove: (ids: IdProp[]) => (s: TableDraftState<Entity>) => void;
  patch: (
    e: PatchEntity<SliceState<Entity>>,
  ) => (s: TableDraftState<Entity>) => void;
  merge: (
    e: PatchEntity<SliceState<Entity>>,
  ) => (s: TableDraftState<Entity>) => void;
  reset: () => (s: TableDraftState<Entity>) => void;
}

export interface TableOutput<Entity = unknown>
  extends BaseSchema<Record<IdProp, Entity>>,
    TableActions<Entity>,
    TableSelectors<Entity> {
  schema: "table";
  /** runtime initial state for the table slice */
  initialState: Record<IdProp, Entity>;
  /** default/empty entity value (or factory) */
  empty: Entity | undefined;
}

export function createTable<Entity = unknown>({
  name,
  empty,
  initialState,
}: {
  name: keyof TableRootState<Entity>;
  initialState?: Record<IdProp, Entity>;
  empty?: Entity | (() => Entity);
}): TableOutput<Entity> {
  const tableInitialState: TableData<Entity> = initialState ?? {};
  const selectors = tableSelectors<Entity, typeof empty>((s) => s[name], empty);

  const output = {
    schema: "table",
    name,
    initialState: tableInitialState,
    empty: empty === undefined ? undefined : isFactory(empty) ? empty() : empty,
    add: (entities) => (s) => {
      const state = s[name];
      Object.assign(state, entities);
    },
    set: (entities) => (s) => {
      const state = s[name];
      // replace table contents in-place
      for (const k of Object.keys(state)) delete state[k];
      Object.assign(state, entities);
    },
    remove: (ids) => (s) => {
      const state = s[name];
      for (const id of ids) delete state[id];
    },
    patch: (entities) => (s) => {
      const state = s[name];
      for (const id of Object.keys(entities)) {
        const existing = state[id];
        const patch = entities[id];
        if (existing && typeof existing === "object") {
          Object.assign(existing, patch);
        }
      }
    },
    merge: (entities) => (s) => {
      const state = s[name];
      for (const id of Object.keys(entities)) {
        const src = entities[id];
        if (!src) continue;
        const srcRec: Record<string, unknown> = isRecord(src) ? src : {};
        const current = state[id];
        const tgtRec: Record<string, unknown> = isRecord(current)
          ? current
          : {};
        for (const prop of Object.keys(srcRec)) {
          const val = srcRec[prop];
          if (Array.isArray(val)) {
            const arr = Array.isArray(tgtRec[prop]) ? tgtRec[prop] : [];
            tgtRec[prop] = [...arr, ...val];
          } else {
            tgtRec[prop] = val;
          }
        }
        Object.assign(state, { [id]: tgtRec });
      }
    },
    reset: () => (s) => {
      const state = s[name];
      for (const k of Object.keys(state)) delete state[k];
      Object.assign(state, tableInitialState);
    },
    ...selectors,
  } satisfies TableOutput<Entity>;

  return output;
}

/**
 * Public table slice API used in `createSchema` definitions.
 *
 * @remarks
 * The table slice mimics a normalized entity table with `id -> entity` storage.
 *
 * Available selectors:
 * - `selectTable`
 * - `selectTableAsList`
 * - `selectById`
 * - `selectByIds`
 *
 * Available updaters:
 * - `add`
 * - `set`
 * - `remove`
 * - `patch`
 * - `merge`
 * - `reset`
 *
 * If `empty` is provided and `selectById` misses, the selector returns that
 * value instead of `undefined`.
 *
 * @param options.initialState - Optional initial entity map.
 * @param options.empty - Optional empty entity or factory.
 * @returns A factory consumed by `createSchema` with the slice name.
 *
 * @example
 * ```ts
 * const schema = createSchema({
 *   users: slice.table<User>({
 *     empty: { id: "", name: "" },
 *   }),
 * });
 * ```
 */
export function table<Entity = unknown>(
  options: {
    initialState?: Record<IdProp, Entity>;
    empty?: Entity | (() => Entity);
  } = {},
): (n: string) => TableOutput<Entity> {
  const { initialState, empty } = options;
  return (name: string) => createTable<Entity>({ name, empty, initialState });
}
