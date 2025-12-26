import {
  type FxMap,
  type FxSchema,
  type StoreUpdater,
  updateStore,
} from "starfx";

export function createSchema<
  O extends FxMap,
  S extends { [key in keyof O]: ReturnType<O[key]>["initialState"] }
>(): [FxSchema<S, O>, S] {
  const initialState = {} as S;
  function* update(ups: StoreUpdater<S> | StoreUpdater<S>[]) {
    return yield* updateStore(ups);
  }

  const db = {} as FxSchema<S, O>;
  db.update = update;

  return [db, initialState];
}
