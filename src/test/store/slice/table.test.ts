import { updateStore } from "../../../store/fx.js";
import { createSchema } from "../../../store/schema.js";
import { createTable, table } from "../../../store/slice/table.js";
import { createStore } from "../../../store/store.js";
import { expect, test } from "../../../test.js";

type TUser = {
  id: number;
  user: string;
};

const NAME = "table";
const empty = { id: 0, user: "" };
const tableSlice = createTable<TUser>({
  name: NAME,
  empty,
});

const first = { id: 1, user: "A" };
const second = { id: 2, user: "B" };
const third = { id: 3, user: "C" };

test("sets up a table", async () => {
  const schema = createSchema({
    [NAME]: () => tableSlice,
  });
  const store = createStore({
    schemas: [schema],
  });

  await store.initialize(function* () {
    yield* updateStore(tableSlice.set({ [first.id]: first }));
  });
  expect(store.getState()[NAME]).toEqual({ [first.id]: first });
});

test("adds a row", async () => {
  const schema = createSchema({
    [NAME]: () => tableSlice,
  });
  const store = createStore({
    schemas: [schema],
  });

  await store.initialize(function* () {
    yield* updateStore(tableSlice.set({ [second.id]: second }));
  });
  expect(store.getState()[NAME]).toEqual({ 2: second });
});

test("removes a row", async () => {
  const schema = createSchema({
    [NAME]: () => tableSlice,
  });
  const store = createStore({
    schemas: [schema],
  });

  // Pre-populate the store
  await store.initialize(function* () {
    yield* updateStore(
      tableSlice.set({ [first.id]: first, [second.id]: second }),
    );

    yield* updateStore(tableSlice.remove(["1"]));
  });
  expect(store.getState()[NAME]).toEqual({ [second.id]: second });
});

test("updates a row", async () => {
  const schema = createSchema({
    [NAME]: () => tableSlice,
  });
  const store = createStore({
    schemas: [schema],
  });
  await store.initialize(function* () {
    const updated = { id: second.id, user: "BB" };
    yield* updateStore(tableSlice.set({ [second.id]: second }));
    yield* updateStore(tableSlice.patch({ [updated.id]: updated }));
  });
  expect(store.getState()[NAME]).toEqual({
    [second.id]: { ...second, user: "BB" },
  });
});

test("gets a row", async () => {
  const schema = createSchema({
    [NAME]: () => tableSlice,
  });
  const store = createStore({
    schemas: [schema],
  });
  await store.initialize(function* () {
    yield* updateStore(
      tableSlice.add({
        [first.id]: first,
        [second.id]: second,
        [third.id]: third,
      }),
    );
  });

  const row = tableSlice.selectById(store.getState(), { id: "2" });
  expect(row).toEqual(second);
});

test("when the record doesnt exist, it returns empty record", () => {
  const schema = createSchema({
    [NAME]: () => tableSlice,
  });
  const store = createStore({
    schemas: [schema],
  });

  const row = tableSlice.selectById(store.getState(), { id: "2" });
  expect(row).toEqual(empty);
});

test("gets all rows", async () => {
  const schema = createSchema({
    [NAME]: () => tableSlice,
  });
  const store = createStore({
    schemas: [schema],
  });
  const data = { [first.id]: first, [second.id]: second, [third.id]: third };
  await store.initialize(function* () {
    yield* updateStore(tableSlice.add(data));
  });
  expect(store.getState()[NAME]).toEqual(data);
});

// checking types of `result` here
test("with empty", async () => {
  const tbl = table<TUser>({ empty: first })("users");
  const schema = createSchema({
    users: () => tbl,
  });
  const store = createStore({
    schemas: [schema],
  });

  expect(tbl.empty).toEqual(first);
  await store.initialize(function* () {
    yield* updateStore(tbl.set({ [first.id]: first }));
  });
  expect(tbl.selectTable(store.getState())).toEqual({
    [first.id]: first,
  });
  const result = tbl.selectById(store.getState(), { id: 1 });
  expect(result).toEqual(first);
});

// checking types of `result` here
test("with no empty", async () => {
  const tbl = table<TUser>()("users");
  const schema = createSchema({
    users: () => tbl,
  });
  const store = createStore({
    schemas: [schema],
  });

  expect(tbl.empty).toEqual(undefined);
  await store.initialize(function* () {
    yield* updateStore(tbl.set({ [first.id]: first }));
  });
  expect(tbl.selectTable(store.getState())).toEqual({
    [first.id]: first,
  });
  const result = tbl.selectById(store.getState(), { id: 1 });
  expect(result).toEqual(first);
});
