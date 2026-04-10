import { call } from "../index.js";
import { createSchema, createStore, select, slice } from "../store/index.js";
import { expect, test } from "../test.js";

interface TestState {
  user: { id: string };
}

test("should be able to grab values from store", async () => {
  let actual: TestState["user"] | undefined;
  const store = createStore({
    schemas: [createSchema({ user: slice.obj({ id: "1" }) })],
  });
  await store.run(function* () {
    actual = yield* select((s: TestState) => s.user);
  });
  expect(actual).toEqual({ id: "1" });
});

test("should be able to grab store from a nested call", async () => {
  let actual: TestState["user"] | undefined;
  const store = createStore({
    schemas: [createSchema({ user: slice.obj({ id: "2" }) })],
  });
  await store.run(function* () {
    actual = yield* call(function* () {
      return yield* select((s: TestState) => s.user);
    });
  });
  expect(actual).toEqual({ id: "2" });
});

test("should accept a single schema option", async () => {
  let actual: TestState["user"] | undefined;
  const schema = createSchema({ user: slice.obj({ id: "3" }) });
  const store = createStore({ schema });

  await store.run(function* () {
    actual = yield* select((s: TestState) => s.user);
  });

  expect(actual).toEqual({ id: "3" });
  expect(store.schema).toBe(schema);
});

test("should reject both schema and schemas", () => {
  const schema = createSchema({ user: slice.obj({ id: "4" }) });

  expect(() =>
    createStore({
      schema,
      schemas: [schema],
    }),
  ).toThrow("Provide either `schema` or `schemas`, not both.");
});

test("should reject missing schema configuration", () => {
  expect(() => createStore({})).toThrow(
    "At least one schema must be provided.",
  );
});
