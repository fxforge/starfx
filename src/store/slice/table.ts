import type { Draft, Immutable } from "immer";
import { createSelector } from "reselect";
import type { IdProp } from "../../types.js";
import type { BaseSchema, SliceState } from "../types.js";

type TableData<Entity> = Record<IdProp, Entity>;
type TableRootState<Entity> = Record<string, TableData<Entity>>;
type TableSelectorState = Record<string, unknown>;
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

export interface TableSelectors<Entity = unknown> {
  findById: (
    d: Immutable<TableData<Entity>>,
    p: PropId,
  ) => Immutable<Entity> | undefined;
  findByIds: (
    d: Immutable<TableData<Entity>>,
    p: PropIds,
  ) => Immutable<Entity>[];
  tableAsList: (d: Immutable<TableData<Entity>>) => Immutable<Entity>[];
  selectTable: (s: TableSelectorState) => Immutable<TableData<Entity>>;
  selectTableAsList: (state: TableSelectorState) => Immutable<Entity[]>;
  selectById: (s: TableSelectorState, p: PropId) => Immutable<Entity>;
  selectByIds: (s: TableSelectorState, p: PropIds) => Immutable<Entity[]>;
}

function tableSelectors<Entity = unknown>(
  selectTable: (s: TableSelectorState) => Immutable<TableData<Entity>>,
  empty: EntityOrFactory<Entity> | undefined,
): TableSelectors<Entity> {
  type ResultSelectors = TableSelectors<Entity>;

  const tableAsList: ResultSelectors["tableAsList"] = (data) =>
    Object.values(data).filter(excludesFalse);
  const findById: ResultSelectors["findById"] = (data, { id }) => data[id];
  const findByIds: ResultSelectors["findByIds"] = (data, { ids }) =>
    ids.map((rowId) => data[rowId]).filter(excludesFalse);

  const selectByIdBase = (state: TableSelectorState, { id }: PropId) => {
    const data = selectTable(state);
    return findById(data, { id });
  };

  const selectById: ResultSelectors["selectById"] = !empty
    ? (state, { id }) => selectByIdBase(state, { id }) as Immutable<Entity>
    : (state, { id }) => {
        if (isFactory(empty)) {
          return (
            selectByIdBase(state, { id }) || (empty() as Immutable<Entity>)
          );
        }
        return selectByIdBase(state, { id }) || (empty as Immutable<Entity>);
      };

  return {
    findById,
    findByIds,
    tableAsList,
    selectTable,
    selectTableAsList: createSelector(selectTable, (data) => tableAsList(data)),
    selectById,
    selectByIds: createSelector(
      selectTable,
      (_, p: PropIds) => p.ids,
      (data, ids) => findByIds(data, { ids }),
    ),
  };
}

export interface TableActions<Entity = unknown> {
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
  initialState: Record<IdProp, Entity>;
  empty: Entity | undefined;
}

export function createTable<Entity = unknown>({
  name,
  empty,
  initialState,
}: {
  name: string;
  initialState?: Record<IdProp, Entity>;
  empty?: Entity | (() => Entity);
}): TableOutput<Entity> {
  const tableInitialState: TableData<Entity> = initialState ?? {};
  const selectors = tableSelectors<Entity>(
    (state) => state[name] as Immutable<TableData<Entity>>,
    empty,
  );

  return {
    schema: "table",
    name: String(name),
    initialState: tableInitialState,
    empty: empty === undefined ? undefined : isFactory(empty) ? empty() : empty,
    add: (entities) => (state) => {
      const table = state[name];
      Object.assign(table, entities);
    },
    set: (entities) => (state) => {
      const table = state[name];
      for (const key of Object.keys(table)) delete table[key];
      Object.assign(table, entities);
    },
    remove: (ids) => (state) => {
      const table = state[name];
      for (const id of ids) delete table[id];
    },
    patch: (entities) => (state) => {
      const table = state[name];
      for (const id of Object.keys(entities)) {
        const existing = table[id];
        const patch = entities[id];
        if (existing && typeof existing === "object") {
          Object.assign(existing, patch);
        }
      }
    },
    merge: (entities) => (state) => {
      const table = state[name];
      for (const id of Object.keys(entities)) {
        const src = entities[id];
        if (!src) continue;
        const srcRec: Record<string, unknown> = isRecord(src) ? src : {};
        const current = table[id];
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
        Object.assign(table, { [id]: tgtRec as Entity });
      }
    },
    reset: () => (state) => {
      const table = state[name];
      for (const key of Object.keys(table)) delete table[key];
      Object.assign(table, tableInitialState);
    },
    ...selectors,
  } satisfies TableOutput<Entity>;
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
