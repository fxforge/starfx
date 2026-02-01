/**
 * Type tests for slice creation
 *
 * These tests verify the type inference and type safety of slice creation.
 * They don't run at runtime - they verify types at compile time.
 */
import { assertType, describe, expectTypeOf, test } from "vitest";
import type { AnyState } from "../types.js";
import { createSchema, slice } from "../store/index.js";
import type {
  AnyOutput,
  LoaderOutput,
  NumOutput,
  ObjOutput,
  StrOutput,
  TableOutput,
} from "../store/slice/index.js";
import type { FxSchema } from "../store/types.js";

// =============================================================================
// Test Entity Types
// =============================================================================

interface User {
  id: string;
  name: string;
  email: string;
}

interface Post {
  id: string;
  title: string;
  authorId: string;
}

const emptyUser: User = { id: "", name: "", email: "" };

// =============================================================================
// slice.str() type tests
// =============================================================================

describe("slice.str types", () => {
  test("str factory returns a function that produces StrOutput", () => {
    const strFactory = slice.str();
    expectTypeOf(strFactory).toBeFunction();
    expectTypeOf(strFactory).parameter(0).toBeString();

    const strSlice = strFactory("token");
    expectTypeOf(strSlice).toMatchTypeOf<StrOutput<AnyState>>();
  });

  test("str slice has correct initialState type", () => {
    const strSlice = slice.str()("token");
    expectTypeOf(strSlice.initialState).toBeString();
  });

  test("str slice set accepts string", () => {
    const strSlice = slice.str()("token");
    const updater = strSlice.set("new-value");
    expectTypeOf(updater).toBeFunction();
    expectTypeOf(updater).parameter(0).toMatchTypeOf<AnyState>();
  });

  test("str slice select returns string", () => {
    const strSlice = slice.str()("token");
    expectTypeOf(strSlice.select).returns.toBeString();
  });

  test("str with custom initial value", () => {
    const strSlice = slice.str("default-token")("token");
    expectTypeOf(strSlice.initialState).toBeString();
  });
});

// =============================================================================
// slice.num() type tests
// =============================================================================

describe("slice.num types", () => {
  test("num factory returns a function that produces NumOutput", () => {
    const numFactory = slice.num();
    expectTypeOf(numFactory).toBeFunction();
    expectTypeOf(numFactory).parameter(0).toBeString();

    const numSlice = numFactory("counter");
    expectTypeOf(numSlice).toMatchTypeOf<NumOutput<AnyState>>();
  });

  test("num slice has correct initialState type", () => {
    const numSlice = slice.num()("counter");
    expectTypeOf(numSlice.initialState).toBeNumber();
  });

  test("num slice set accepts number", () => {
    const numSlice = slice.num()("counter");
    const updater = numSlice.set(42);
    expectTypeOf(updater).toBeFunction();
  });

  test("num slice increment/decrement accept optional number", () => {
    const numSlice = slice.num()("counter");
    expectTypeOf(numSlice.increment)
      .parameter(0)
      .toEqualTypeOf<number | undefined>();
    expectTypeOf(numSlice.decrement)
      .parameter(0)
      .toEqualTypeOf<number | undefined>();
  });

  test("num slice select returns number", () => {
    const numSlice = slice.num()("counter");
    expectTypeOf(numSlice.select).returns.toBeNumber();
  });
});

// =============================================================================
// slice.any() type tests
// =============================================================================

describe("slice.any types", () => {
  test("any factory infers type from initial value", () => {
    const boolFactory = slice.any<boolean>(false);
    const boolSlice = boolFactory("enabled");
    expectTypeOf(boolSlice).toMatchTypeOf<AnyOutput<boolean, AnyState>>();
    expectTypeOf(boolSlice.initialState).toBeBoolean();
  });

  test("any slice set accepts the inferred type", () => {
    const boolSlice = slice.any<boolean>(false)("enabled");
    const updater = boolSlice.set(true);
    expectTypeOf(updater).toBeFunction();

    // @ts-expect-error - should not accept string
    boolSlice.set("invalid");
  });

  test("any slice select returns the inferred type", () => {
    const boolSlice = slice.any<boolean>(false)("enabled");
    expectTypeOf(boolSlice.select).returns.toBeBoolean();
  });

  test("any with complex type", () => {
    type Theme = "light" | "dark" | "system";
    const themeSlice = slice.any<Theme>("system")("theme");
    expectTypeOf(themeSlice.initialState).toEqualTypeOf<Theme>();
    expectTypeOf(themeSlice.select).returns.toEqualTypeOf<Theme>();
  });

  test("any with array type", () => {
    const tagsSlice = slice.any<string[]>([])("tags");
    expectTypeOf(tagsSlice.initialState).toEqualTypeOf<string[]>();
    expectTypeOf(tagsSlice.select).returns.toEqualTypeOf<string[]>();
  });
});

// =============================================================================
// slice.obj() type tests
// =============================================================================

describe("slice.obj types", () => {
  test("obj factory infers type from initial value", () => {
    const userFactory = slice.obj<User>(emptyUser);
    const userSlice = userFactory("currentUser");
    expectTypeOf(userSlice).toMatchTypeOf<ObjOutput<User, AnyState>>();
  });

  test("obj slice has correct initialState type", () => {
    const userSlice = slice.obj<User>(emptyUser)("currentUser");
    expectTypeOf(userSlice.initialState).toEqualTypeOf<User>();
  });

  test("obj slice set accepts the object type", () => {
    const userSlice = slice.obj<User>(emptyUser)("currentUser");
    const updater = userSlice.set({
      id: "1",
      name: "Test",
      email: "test@example.com",
    });
    expectTypeOf(updater).toBeFunction();
  });

  test("obj slice update has typed key and value", () => {
    const userSlice = slice.obj<User>(emptyUser)("currentUser");

    // Valid updates
    userSlice.update({ key: "name", value: "New Name" });
    userSlice.update({ key: "email", value: "new@example.com" });

    // @ts-expect-error - invalid key
    userSlice.update({ key: "invalid", value: "test" });

    // @ts-expect-error - wrong value type for key
    userSlice.update({ key: "name", value: 123 });
  });

  test("obj slice select returns the object type", () => {
    const userSlice = slice.obj<User>(emptyUser)("currentUser");
    expectTypeOf(userSlice.select).returns.toEqualTypeOf<User>();
  });
});

// =============================================================================
// slice.table() type tests
// =============================================================================

describe("slice.table types", () => {
  test("table factory returns TableOutput", () => {
    const tableFactory = slice.table<User>();
    const usersSlice = tableFactory("users");
    expectTypeOf(usersSlice).toMatchTypeOf<
      TableOutput<User, AnyState, User | undefined>
    >();
  });

  test("table with empty returns non-undefined selectById", () => {
    const usersSlice = slice.table<User>({ empty: emptyUser })("users");
    expectTypeOf(usersSlice).toMatchTypeOf<TableOutput<User, AnyState, User>>();

    // selectById should return User (not User | undefined)
    expectTypeOf(usersSlice.selectById).returns.toEqualTypeOf<User>();
    expectTypeOf(usersSlice.findById).returns.toEqualTypeOf<User>();
  });

  test("table without empty returns possibly undefined selectById", () => {
    const usersSlice = slice.table<User>()("users");

    // selectById should return User | undefined
    expectTypeOf(usersSlice.selectById).returns.toEqualTypeOf<
      User | undefined
    >();
  });

  test("table slice add accepts correct record type", () => {
    const usersSlice = slice.table<User>()("users");
    const updater = usersSlice.add({
      "1": { id: "1", name: "Alice", email: "alice@example.com" },
    });
    expectTypeOf(updater).toBeFunction();
  });

  test("table slice patch accepts partial entity", () => {
    const usersSlice = slice.table<User>()("users");
    // patch should accept Partial<User> for each key
    usersSlice.patch({ "1": { name: "Updated" } });
  });

  test("table slice selectTable returns correct record type", () => {
    const usersSlice = slice.table<User>()("users");
    expectTypeOf(usersSlice.selectTable).returns.toMatchTypeOf<
      Record<string | number, User>
    >();
  });

  test("table slice selectTableAsList returns array", () => {
    const usersSlice = slice.table<User>()("users");
    expectTypeOf(usersSlice.selectTableAsList).returns.toEqualTypeOf<User[]>();
  });

  test("table slice selectByIds returns array", () => {
    const usersSlice = slice.table<User>()("users");
    expectTypeOf(usersSlice.selectByIds).returns.toEqualTypeOf<User[]>();
  });

  test("table with empty factory function", () => {
    const usersSlice = slice.table<User>({ empty: () => emptyUser })("users");
    expectTypeOf(usersSlice.empty).toEqualTypeOf<User>();
    expectTypeOf(usersSlice.selectById).returns.toEqualTypeOf<User>();
  });
});

// =============================================================================
// slice.loaders() type tests
// =============================================================================

describe("slice.loaders types", () => {
  test("loaders factory returns LoaderOutput", () => {
    const loadersFactory = slice.loaders();
    const loadersSlice = loadersFactory("loaders");
    expectTypeOf(loadersSlice).toMatchTypeOf<
      LoaderOutput<AnyState, AnyState>
    >();
  });

  test("loaders slice start/success/error accept LoaderPayload", () => {
    const loadersSlice = slice.loaders()("loaders");

    // Basic usage with just id
    loadersSlice.start({ id: "fetch-users" });
    loadersSlice.success({ id: "fetch-users" });
    loadersSlice.error({ id: "fetch-users" });

    // With message
    loadersSlice.error({ id: "fetch-users", message: "Failed to fetch" });
  });

  test("loaders with custom meta type", () => {
    interface LoaderMeta {
      endpoint: string;
      retryCount: number;
    }

    const loadersSlice = slice.loaders<LoaderMeta>()("loaders");

    // Should accept meta with correct type
    loadersSlice.start({
      id: "fetch-users",
      meta: { endpoint: "/api/users", retryCount: 0 },
    });
  });

  test("loaders selectById returns LoaderState", () => {
    const loadersSlice = slice.loaders()("loaders");
    // Type-only test - we check the return type without calling the selector
    type SelectByIdResult = ReturnType<typeof loadersSlice.selectById>;

    expectTypeOf<SelectByIdResult>().toHaveProperty("status");
    expectTypeOf<SelectByIdResult>().toHaveProperty("isLoading");
    expectTypeOf<SelectByIdResult>().toHaveProperty("isError");
    expectTypeOf<SelectByIdResult>().toHaveProperty("isSuccess");
    expectTypeOf<SelectByIdResult>().toHaveProperty("isIdle");
  });
});

// =============================================================================
// createSchema type tests
// =============================================================================

describe("createSchema types", () => {
  test("schema infers state type from slices", () => {
    const schema = createSchema({
      users: slice.table<User>({ empty: emptyUser }),
      posts: slice.table<Post>(),
      token: slice.str(),
      counter: slice.num(),
      isDarkMode: slice.any<boolean>(false),
      currentUser: slice.obj<User>(emptyUser),
      cache: slice.table({ empty: {} }),
      loaders: slice.loaders(),
    });

    // Schema should have the correct slice outputs
    expectTypeOf(schema.users).toMatchTypeOf<TableOutput<User, any, User>>();
    expectTypeOf(schema.posts).toMatchTypeOf<
      TableOutput<Post, any, Post | undefined>
    >();
    expectTypeOf(schema.token).toMatchTypeOf<StrOutput<any>>();
    expectTypeOf(schema.counter).toMatchTypeOf<NumOutput<any>>();
    expectTypeOf(schema.currentUser).toMatchTypeOf<ObjOutput<User, any>>();
  });

  test("schema initialState has correct shape", () => {
    const schema = createSchema({
      users: slice.table<User>(),
      token: slice.str("default"),
      counter: slice.num(10),
      cache: slice.table({ empty: {} }),
      loaders: slice.loaders(),
    });

    expectTypeOf(schema.initialState).toHaveProperty("users");
    expectTypeOf(schema.initialState).toHaveProperty("token");
    expectTypeOf(schema.initialState).toHaveProperty("counter");
    expectTypeOf(schema.initialState).toHaveProperty("cache");
    expectTypeOf(schema.initialState).toHaveProperty("loaders");
  });

  test("default schema has cache and loaders", () => {
    const schema = createSchema();

    expectTypeOf(schema).toHaveProperty("cache");
    expectTypeOf(schema).toHaveProperty("loaders");
    expectTypeOf(schema).toHaveProperty("update");
    expectTypeOf(schema).toHaveProperty("initialState");
    expectTypeOf(schema).toHaveProperty("reset");
  });

  test("schema update accepts store updater", () => {
    const schema = createSchema({
      counter: slice.num(),
      cache: slice.table({ empty: {} }),
      loaders: slice.loaders(),
    });

    // update should accept the slice updater functions
    expectTypeOf(schema.update).toBeFunction();
  });
});

// =============================================================================
// Composite slice type tests (state parameter inference)
// =============================================================================

describe("state parameter inference", () => {
  test("slice methods should work with composed state", () => {
    // This tests that slice methods can be used correctly within schema.update()
    // The state parameter S should be inferred correctly from the schema

    const schema = createSchema({
      users: slice.table<User>({ empty: emptyUser }),
      counter: slice.num(),
      cache: slice.table({ empty: {} }),
      loaders: slice.loaders(),
    });

    // These should all type-check correctly
    const addUser = schema.users.add({ "1": emptyUser });
    const increment = schema.counter.increment();

    expectTypeOf(addUser).toBeFunction();
    expectTypeOf(increment).toBeFunction();
  });
});

// =============================================================================
// Edge cases and advanced scenarios
// =============================================================================

describe("advanced type scenarios", () => {
  test("nested object in slice.obj", () => {
    interface Settings {
      theme: {
        primary: string;
        secondary: string;
      };
      notifications: {
        email: boolean;
        push: boolean;
      };
    }

    const settingsSlice = slice.obj<Settings>({
      theme: { primary: "#000", secondary: "#fff" },
      notifications: { email: true, push: false },
    })("settings");

    expectTypeOf(settingsSlice.select).returns.toEqualTypeOf<Settings>();

    // update should work with nested keys
    settingsSlice.update({
      key: "theme",
      value: { primary: "#111", secondary: "#eee" },
    });
  });

  test("table with complex entity", () => {
    interface ComplexEntity {
      id: string;
      data: {
        nested: {
          value: number;
        };
      };
      tags: string[];
      metadata: Record<string, unknown>;
    }

    const complexSlice = slice.table<ComplexEntity>()("complex");
    expectTypeOf(complexSlice.selectTableAsList).returns.toEqualTypeOf<
      ComplexEntity[]
    >();
  });

  test("multiple tables with different entity types", () => {
    const schema = createSchema({
      users: slice.table<User>({ empty: emptyUser }),
      posts: slice.table<Post>({ empty: { id: "", title: "", authorId: "" } }),
      cache: slice.table({ empty: {} }),
      loaders: slice.loaders(),
    });

    // Each table should maintain its own entity type
    // Type-only checks - we verify return types without calling selectors
    type UserListResult = ReturnType<typeof schema.users.selectTableAsList>;
    type PostListResult = ReturnType<typeof schema.posts.selectTableAsList>;

    expectTypeOf<UserListResult>().toEqualTypeOf<User[]>();
    expectTypeOf<PostListResult>().toEqualTypeOf<Post[]>();
  });
});
