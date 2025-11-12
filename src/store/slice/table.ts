import { createSelector } from "reselect";
import type { AnyState, IdProp } from "../../types.js";
import type { BaseSchema } from "../types.js";

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

function mustSelectEntity<Entity extends AnyState = AnyState>(
  defaultEntity: Entity | (() => Entity),
) {
  const isFn = typeof defaultEntity === "function";

  return function selectEntity<S extends AnyState = AnyState>(
    selectById: (s: S, p: PropId) => Entity | undefined,
  ) {
    return (state: S, { id }: PropId): Entity => {
      if (isFn) {
        const entity = defaultEntity as () => Entity;
        return selectById(state, { id }) || entity();
      }

      return selectById(state, { id }) || (defaultEntity as Entity);
    };
  };
}

function tableSelectors<
  Entity extends AnyState = AnyState,
  S extends AnyState = AnyState,
>(
  selectTable: (s: S) => Record<IdProp, Entity>,
  empty?: Entity | (() => Entity) | undefined,
) {
  const must = empty ? mustSelectEntity(empty) : null;
  const tableAsList = (data: Record<IdProp, Entity>): Entity[] =>
    Object.values(data).filter(excludesFalse);
  const findById = (data: Record<IdProp, Entity>, { id }: PropId) => data[id];
  const findByIds = (
    data: Record<IdProp, Entity>,
    { ids }: PropIds,
  ): Entity[] => ids.map((id) => data[id]).filter(excludesFalse);
  const selectById = (
    state: S,
    { id }: PropId,
  ): typeof empty extends undefined ? Entity | undefined : Entity => {
    const data = selectTable(state);
    return findById(data, { id });
  };

  const sbi = must ? must(selectById) : selectById;

  return {
    findById: must ? must(findById) : findById,
    findByIds,
    tableAsList,
    selectTable,
    selectTableAsList: createSelector(selectTable, (data): Entity[] =>
      tableAsList(data),
    ),
    selectById: sbi,
    selectByIds: createSelector(
      selectTable,
      (_: S, p: PropIds) => p.ids,
      (data, ids) => findByIds(data, { ids }),
    ),
  };
}

export interface TableOutput<
  Entity extends AnyState,
  S extends AnyState,
  Empty extends Entity | undefined = Entity | undefined,
> extends BaseSchema<Record<IdProp, Entity>> {
  schema: "table";
  initialState: Record<IdProp, Entity>;
  empty: Empty;
  add: (e: Record<IdProp, Entity>) => (s: S) => void;
  set: (e: Record<IdProp, Entity>) => (s: S) => void;
  remove: (ids: IdProp[]) => (s: S) => void;
  patch: (e: PatchEntity<Record<IdProp, Entity>>) => (s: S) => void;
  merge: (e: PatchEntity<Record<IdProp, Entity>>) => (s: S) => void;
  reset: () => (s: S) => void;
  findById: (d: Record<IdProp, Entity>, { id }: PropId) => Empty;
  findByIds: (d: Record<IdProp, Entity>, { ids }: PropIds) => Entity[];
  tableAsList: (d: Record<IdProp, Entity>) => Entity[];
  selectTable: (s: S) => Record<IdProp, Entity>;
  selectTableAsList: (state: S) => Entity[];
  selectById: (s: S, p: PropId) => Empty;
  selectByIds: (s: S, p: PropIds) => Entity[];
}

export function createTable<
  Entity extends AnyState = AnyState,
  S extends AnyState = AnyState,
>(p: {
  name: keyof S;
  initialState?: Record<IdProp, Entity>;
  empty: Entity | (() => Entity);
}): TableOutput<Entity, S, Entity>;
export function createTable<
  Entity extends AnyState = AnyState,
  S extends AnyState = AnyState,
>(p: {
  name: keyof S;
  initialState?: Record<IdProp, Entity>;
  empty?: Entity | (() => Entity);
}): TableOutput<Entity, S, Entity | undefined>;
export function createTable<
  Entity extends AnyState = AnyState,
  S extends AnyState = AnyState,
>({
  name,
  empty,
  initialState = {},
}: {
  name: keyof S;
  initialState?: Record<IdProp, Entity>;
  empty?: Entity | (() => Entity);
}): TableOutput<Entity, S, Entity | undefined> {
  const selectors = tableSelectors<Entity, S>((s: S) => s[name], empty);

  return {
    schema: "table",
    name: name as string,
    initialState,
    empty: typeof empty === "function" ? empty() : empty,
    add: (entities) => (s) => {
      const state = selectors.selectTable(s);
      Object.keys(entities).forEach((id) => {
        state[id] = entities[id];
      });
    },
    set: (entities) => (s) => {
      (s as any)[name] = entities;
    },
    remove: (ids) => (s) => {
      const state = selectors.selectTable(s);
      ids.forEach((id) => {
        delete state[id];
      });
    },
    patch: (entities) => (s) => {
      const state = selectors.selectTable(s);
      Object.keys(entities).forEach((id) => {
        state[id] = { ...state[id], ...entities[id] };
      });
    },
    merge: (entities) => (s) => {
      const state = selectors.selectTable(s);
      Object.keys(entities).forEach((id) => {
        const entity = entities[id];
        Object.keys(entity).forEach((prop) => {
          const val = entity[prop];
          if (Array.isArray(val)) {
            const list = val as any[];
            (state as any)[id][prop].push(...list);
          } else {
            (state as any)[id][prop] = entities[id][prop];
          }
        });
      });
    },
    reset: () => (s) => {
      (s as any)[name] = initialState;
    },
    ...selectors,
  };
}

export function table<
  Entity extends AnyState = AnyState,
  S extends AnyState = AnyState,
>(p: {
  initialState?: Record<IdProp, Entity>;
  empty: Entity | (() => Entity);
}): (n: string) => TableOutput<Entity, S, Entity>;
export function table<
  Entity extends AnyState = AnyState,
  S extends AnyState = AnyState,
>(p?: {
  initialState?: Record<IdProp, Entity>;
  empty?: Entity | (() => Entity);
}): (n: string) => TableOutput<Entity, S, Entity | undefined>;
export function table<
  Entity extends AnyState = AnyState,
  S extends AnyState = AnyState,
>({
  initialState,
  empty,
}: {
  initialState?: Record<IdProp, Entity>;
  empty?: Entity | (() => Entity);
} = {}): (n: string) => TableOutput<Entity, S, Entity | undefined> {
  return (name: string) => createTable<Entity>({ name, empty, initialState });
}
