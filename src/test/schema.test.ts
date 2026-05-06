import { createSchema, createStore, select, slice } from "../store/index.js";
import { expect, test } from "../test.js";

interface User {
  id: string;
  name: string;
}
interface UserWithRoles extends User {
  roles: string[];
}

const emptyUser = { id: "", name: "" };

test("default schema", async () => {
  const schema = createSchema();
  const store = createStore({ schema });
  const { cache, loaders } = schema;

  if (!cache || !loaders) {
    throw new Error("default schema should include cache and loaders");
  }

  expect(store.getState()).toEqual({
    cache: {},
    loaders: {},
  });

  await store.run(function* () {
    yield* schema.update(loaders.start({ id: "1" }));
    yield* schema.update(cache.add({ "1": { ready: true } }));
  });

  expect(cache.selectTable(store.getState())).toEqual({
    "1": { ready: true },
  });
  expect(loaders.selectById(store.getState(), { id: "1" }).status, "loading");
});

test("general types and functionality", async () => {
  expect.assertions(8);
  const db = createSchema({
    users: slice.table<User>({
      initialState: { "1": { id: "1", name: "wow" } },
      empty: emptyUser,
    }),
    token: slice.str(),
    counter: slice.num(),
    dev: slice.any<boolean>(false),
    currentUser: slice.obj<User>(emptyUser),
    cache: slice.table({ empty: {} }),
    loaders: slice.loaders(),
  });
  const store = createStore({ schema: db });

  expect(store.getState()).toEqual({
    users: { "1": { id: "1", name: "wow" } },
    token: "",
    counter: 0,
    dev: false,
    currentUser: { id: "", name: "" },
    cache: {},
    loaders: {},
  });
  type State = ReturnType<typeof store.getState>;
  const userMap = db.users.selectTable(store.getState());
  expect(userMap).toEqual({ "1": { id: "1", name: "wow" } });

  await store.run(function* () {
    yield* db.update([
      db.users.add({ "2": { id: "2", name: "bob" } }),
      db.users.patch({ "1": { name: "zzz" } }),
    ]);

    const users = yield* select((state: State) => db.users.selectTable(state));
    expect(users).toEqual({
      "1": { id: "1", name: "zzz" },
      "2": { id: "2", name: "bob" },
    });

    yield* db.update(db.counter.increment());
    const counter = yield* select((state: State) => db.counter.select(state));
    expect(counter).toBe(1);

    yield* db.update(db.currentUser.update({ key: "name", value: "vvv" }));
    const curUser = yield* select((state: State) =>
      db.currentUser.select(state),
    );
    expect(curUser).toEqual({ id: "", name: "vvv" });

    yield* db.update(db.loaders.start({ id: "fetch-users" }));
    const fetchLoader = yield* select(
      (state: State, id: string) => db.loaders.selectById(state, { id }),
      "fetch-users",
    );
    expect(fetchLoader.id).toBe("fetch-users");
    expect(fetchLoader.status).toBe("loading");
    expect(fetchLoader.lastRun).not.toBe(0);
  });
});

test("can work with a nested object", async () => {
  expect.assertions(3);
  const db = createSchema({
    currentUser: slice.obj<UserWithRoles>({ id: "", name: "", roles: [] }),
    cache: slice.table({ empty: {} }),
    loaders: slice.loaders(),
  });
  const store = createStore({ schema: db });
  type State = ReturnType<typeof store.getState>;
  await store.run(function* () {
    yield* db.update(db.currentUser.update({ key: "name", value: "vvv" }));
    const curUser = yield* select((state: State) =>
      db.currentUser.select(state),
    );
    expect(curUser).toEqual({ id: "", name: "vvv", roles: [] });

    yield* db.update(db.currentUser.update({ key: "roles", value: ["admin"] }));
    const curUser2 = yield* select((state: State) =>
      db.currentUser.select(state),
    );
    expect(curUser2).toEqual({ id: "", name: "vvv", roles: ["admin"] });

    yield* db.update(
      db.currentUser.update({ key: "roles", value: ["admin", "users"] }),
    );
    const curUser3 = yield* select((state: State) =>
      db.currentUser.select(state),
    );
    expect(curUser3).toEqual({
      id: "",
      name: "vvv",
      roles: ["admin", "users"],
    });
  });
});
