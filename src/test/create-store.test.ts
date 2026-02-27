import { call } from "../index.js";
import { createSchema, createStore, select, slice } from "../store/index.js";
import { expect, test } from "../test.js";

interface TestState {
  user: { id: string };
}

test("should be able to grab values from store", async () => {
  let actual;
  const store = createStore({
    schemas: [createSchema({ user: slice.obj({ id: "1" }) })],
  });
  await store.run(function* () {
    actual = yield* select((s: TestState) => s.user);
  });
  expect(actual).toEqual({ id: "1" });
});

test("should be able to grab store from a nested call", async () => {
  let actual;
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
