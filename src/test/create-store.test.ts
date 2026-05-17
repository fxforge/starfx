import { expectTypeOf } from "vitest";
import { call } from "../index.js";
import {
  createSchema,
  createStore,
  expectStore,
  select,
  slice,
} from "../store/index.js";
import { expect, test } from "../test.js";

interface TestState {
  user: { id: string };
}

interface BaseState {
  users: Record<string | number, { id: string; name: string }>;
}

interface MetadataState {
  metadata: Record<string, string>;
}

test("should be able to grab values from store", async () => {
  let actual: TestState["user"] | undefined;
  const store = createStore({
    schema: createSchema({ user: slice.obj({ id: "1" }) }),
  });
  await store.run(function* () {
    actual = yield* select((s: TestState) => s.user);
  });
  expect(actual).toEqual({ id: "1" });
});

test("should be able to grab store from a nested call", async () => {
  let actual: TestState["user"] | undefined;
  const store = createStore({
    schema: createSchema({ user: slice.obj({ id: "2" }) }),
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

test("should reject schema registries without default", () => {
  const metadata = createSchema({
    metadata: slice.obj<Record<string, string>>({}),
  });

  expect(() =>
    createStore(
      // biome-ignore lint/suspicious/noExplicitAny: runtime validation test intentionally passes an invalid config shape.
      { schema: { metadata } } as any,
    ),
  ).toThrow("A schema registry must include `default`");
});

test("should reject missing schema configuration", () => {
  expect(() =>
    // biome-ignore lint/suspicious/noExplicitAny: runtime validation test intentionally passes an invalid config shape.
    createStore({} as any),
  ).toThrow("At least one schema must be provided.");
});

test("should keep base schema typing while merging store state across schemas", () => {
  const baseSchema = createSchema({
    users: slice.table<{ id: string; name: string }>(),
  });
  const metadataSchema = createSchema({
    metadata: slice.obj<Record<string, string>>({}),
  });
  const store = createStore({
    schema: { default: baseSchema, metadata: metadataSchema },
  });

  const readBaseUsers = () => store.schema.users.selectTableAsList;
  expectTypeOf(readBaseUsers).toBeFunction();

  // @ts-expect-error base schema should not expose slices from later schemas
  const readMetadataFromBaseSchema = () => store.schema.metadata.select;
  void readMetadataFromBaseSchema;

  const state = store.getState();
  expectTypeOf(state.users).toEqualTypeOf<BaseState["users"]>();
  expectTypeOf(state.metadata).toEqualTypeOf<MetadataState["metadata"]>();
});

test("should require default in schema registries", () => {
  const metadataSchema = createSchema({
    metadata: slice.obj<Record<string, string>>({}),
  });
  const schema = { metadata: metadataSchema };

  // @ts-expect-error schema registries must include a default schema
  const createStoreWithoutDefault = () => createStore({ schema });
  void createStoreWithoutDefault;
});

test("should keep multi-schema typing for schema registry variables", () => {
  const baseSchema = createSchema({
    users: slice.table<{ id: string; name: string }>(),
  });
  const metadataSchema = createSchema({
    metadata: slice.obj<Record<string, string>>({}),
  });
  const schema = { default: baseSchema, metadata: metadataSchema };
  const store = createStore({ schema });

  const readBaseUsers = () => store.schema.users.selectTableAsList;
  expectTypeOf(readBaseUsers).toBeFunction();

  // @ts-expect-error base schema should not expose slices from later schemas
  const readMetadataFromBaseSchema = () => store.schema.metadata.select;
  void readMetadataFromBaseSchema;

  const state = store.getState();
  expectTypeOf(state.users).toEqualTypeOf<BaseState["users"]>();
  expectTypeOf(state.metadata).toEqualTypeOf<MetadataState["metadata"]>();
});

test("expectStore should preserve merged state for schema registries", () => {
  const baseSchema = createSchema({
    users: slice.table<{ id: string; name: string }>(),
  });
  const metadataSchema = createSchema({
    metadata: slice.obj<Record<string, string>>({}),
  });
  const schema = { default: baseSchema, metadata: metadataSchema };

  function* operation() {
    const runtimeStore = yield* expectStore<typeof schema>();
    const state = runtimeStore.getState();

    expectTypeOf(state.users).toEqualTypeOf<BaseState["users"]>();
    expectTypeOf(state.metadata).toEqualTypeOf<MetadataState["metadata"]>();
  }

  void operation;
});
