import {
  createApi,
  createKey,
  mdw,
  put,
  safe,
  takeEvery,
  takeLatest,
  until,
  waitFor,
} from "../index.js";
import type { ApiCtx, Next, ThunkCtx } from "../index.js";
import {
  createSchema,
  createStore,
  slice,
  updateStore,
  waitForLoader,
} from "../store/index.js";
import { assertLike, expect, test } from "../test.js";

interface User {
  id: string;
  name: string;
  email: string;
}

const emptyUser: User = { id: "", name: "", email: "" };
const mockUser: User = { id: "1", name: "test", email: "test@test.com" };
const mockUser2: User = { id: "2", name: "two", email: "two@test.com" };

const jsonBlob = (data: any) => {
  return JSON.stringify(data);
};

const testStore = () => {
  const schema = createSchema({
    users: slice.table<User>({ empty: emptyUser }),
    loaders: slice.loaders(),
    cache: slice.table({ empty: {} }),
  });
  const store = createStore({ schemas: [schema] });
  return { schema, store };
};

test("basic", () => {
  const { store, schema } = testStore();
  const query = createApi<ApiCtx>();
  query.use(mdw.api({ schema }));
  query.use(query.routes());
  query.use(function* fetchApi(ctx, next) {
    if (`${ctx.req().url}`.startsWith("/users/")) {
      ctx.json = { ok: true, value: mockUser2 };
      yield* next();
      return;
    }
    const data = {
      users: [mockUser],
    };
    ctx.json = { ok: true, value: data };
    yield* next();
  });

  const fetchUsers = query.create(
    "/users",
    { supervisor: takeEvery },
    function* processUsers(ctx: ApiCtx<unknown, { users: User[] }>, next) {
      yield* next();
      if (!ctx.json.ok) return;
      const { users } = ctx.json.value;

      yield* updateStore((state) => {
        users.forEach((u) => {
          state.users[u.id] = u;
        });
      });
    },
  );

  const fetchUser = query.create<{ id: string }>(
    "/users/:id",
    {
      supervisor: takeLatest,
    },
    function* processUser(ctx, next) {
      ctx.request = ctx.req({ method: "POST" });
      yield* next();
      if (!ctx.json.ok) return;
      const curUser = ctx.json.value;
      yield* updateStore((state) => {
        state.users[curUser.id] = curUser;
      });
    },
  );

  store.run(query.register);

  store.dispatch(fetchUsers());
  expect(store.getState().users).toEqual({ [mockUser.id]: mockUser });
  store.dispatch(fetchUser({ id: "2" }));
  expect(store.getState().users).toEqual({
    [mockUser.id]: mockUser,
    [mockUser2.id]: mockUser2,
  });
});

test("with loader", () => {
  const { schema, store } = testStore();
  const api = createApi<ApiCtx>();
  api.use(mdw.api({ schema }));
  api.use(api.routes());
  api.use(function* fetchApi(ctx, next) {
    ctx.response = new Response(jsonBlob(mockUser), { status: 200 });
    const data = { users: [mockUser] };
    ctx.json = { ok: true, value: data };
    yield* next();
  });

  const fetchUsers = api.create(
    "/users",
    { supervisor: takeEvery },
    function* processUsers(ctx: ApiCtx<unknown, { users: User[] }>, next) {
      yield* next();
      if (!ctx.json.ok) return;

      const { value } = ctx.json;

      yield* updateStore((state) => {
        value.users.forEach((u) => {
          state.users[u.id] = u;
        });
      });
    },
  );

  store.run(api.register);

  store.dispatch(fetchUsers());
  assertLike(store.getState(), {
    users: { [mockUser.id]: mockUser },
    loaders: {
      "/users": {
        status: "success",
      },
    },
  });
});

test("with item loader", () => {
  const { store, schema } = testStore();
  const api = createApi<ApiCtx>();
  api.use(mdw.api({ schema }));
  api.use(api.routes());
  api.use(function* fetchApi(ctx, next) {
    ctx.response = new Response(jsonBlob(mockUser), { status: 200 });
    const data = { users: [mockUser] };
    ctx.json = { ok: true, value: data };
    yield* next();
  });

  const fetchUser = api.create<{ id: string }>(
    "/users/:id",
    { supervisor: takeEvery },
    function* processUsers(ctx: ApiCtx<unknown, { users: User[] }>, next) {
      yield* next();
      if (!ctx.json.ok) return;

      const { value } = ctx.json;
      yield* updateStore((state) => {
        value.users.forEach((u) => {
          state.users[u.id] = u;
        });
      });
    },
  );

  store.run(api.register);

  const action = fetchUser({ id: mockUser.id });
  store.dispatch(action);
  assertLike(store.getState(), {
    users: { [mockUser.id]: mockUser },
    loaders: {
      "/users/:id": {
        status: "success",
      },
      [action.payload.key]: {
        status: "success",
      },
    },
  });
});

test("with POST", () => {
  const { store, schema } = testStore();
  const query = createApi();
  query.use(mdw.queryCtx);
  query.use(mdw.api({ schema }));
  query.use(query.routes());
  query.use(function* fetchApi(ctx, next) {
    const request = ctx.req();
    expect(request).toEqual({
      url: "/users",
      headers: {},
      method: "POST",
      body: JSON.stringify({ email: "test@test.com" }),
    });

    const data = {
      users: [mockUser],
    };
    ctx.response = new Response(jsonBlob(data), { status: 200 });
    yield* next();
  });

  const createUser = query.create<{ email: string }>(
    "/users [POST]",
    { supervisor: takeEvery },
    function* processUsers(
      ctx: ApiCtx<{ email: string }, { users: User[] }>,
      next,
    ) {
      ctx.request = ctx.req({
        method: "POST",
        body: JSON.stringify({ email: ctx.payload.email }),
      });

      yield* next();

      if (!ctx.json.ok) return;

      const { users } = ctx.json.value;
      yield* updateStore((state) => {
        users.forEach((u) => {
          state.users[u.id] = u;
        });
      });
    },
  );

  store.run(query.register);
  store.dispatch(createUser({ email: mockUser.email }));
});

test("simpleCache", () => {
  const { store, schema } = testStore();
  const api = createApi<ApiCtx>();
  api.use(mdw.api({ schema }));
  api.use(api.routes());
  api.use(function* fetchApi(ctx, next) {
    const data = { users: [mockUser] };
    ctx.response = new Response(jsonBlob(data));
    ctx.json = { ok: true, value: data };
    yield* next();
  });

  const fetchUsers = api.get("/users", { supervisor: takeEvery }, api.cache());
  store.run(api.register);

  const action = fetchUsers();
  store.dispatch(action);
  assertLike(store.getState(), {
    data: {
      [action.payload.key]: { users: [mockUser] },
    },
    loaders: {
      [`${fetchUsers}`]: {
        status: "success",
      },
    },
  });
});

test("overriding default loader behavior", () => {
  const { store, schema } = testStore();
  const api = createApi<ApiCtx>();
  api.use(mdw.api({ schema }));
  api.use(api.routes());
  api.use(function* fetchApi(ctx, next) {
    const data = { users: [mockUser] };
    ctx.response = new Response(jsonBlob(data));
    ctx.json = { ok: true, value: data };
    yield* next();
  });

  const fetchUsers = api.create(
    "/users",
    { supervisor: takeEvery },
    function* (ctx: ApiCtx<unknown, { users: User[] }>, next) {
      yield* next();

      if (!ctx.json.ok) {
        return;
      }
      const { value } = ctx.json;
      ctx.loader = { message: "yes", meta: { wow: true } };
      yield* updateStore((state) => {
        value.users.forEach((u) => {
          state.users[u.id] = u;
        });
      });
    },
  );

  store.run(api.register);

  store.dispatch(fetchUsers());
  assertLike(store.getState(), {
    users: { [mockUser.id]: mockUser },
    loaders: {
      [`${fetchUsers}`]: {
        status: "success",
        message: "yes",
        meta: { wow: true },
      },
    },
  });
});

test("mdw.api() - error handler", () => {
  let err = false;
  console.error = (msg: string) => {
    if (err) return;
    expect(msg).toBe("Error: something happened.  Check the endpoint [/users]");
    err = true;
  };

  const { schema, store } = testStore();
  const query = createApi<ApiCtx>();
  query.use(mdw.api({ schema }));
  query.use(query.routes());
  query.use(function* () {
    throw new Error("something happened");
  });

  const fetchUsers = query.create("/users", { supervisor: takeEvery });

  store.run(query.register);
  store.dispatch(fetchUsers());
});

test("createApi with own key", async () => {
  const { schema, store } = testStore();
  const query = createApi();
  query.use(mdw.api({ schema }));
  query.use(query.routes());
  query.use(mdw.customKey);
  query.use(function* fetchApi(ctx, next) {
    const data = {
      users: [{ ...mockUser, ...ctx.action.payload.options }],
    };
    ctx.response = new Response(jsonBlob(data), { status: 200 });
    yield* next();
  });

  const theTestKey = `some-custom-key-${Math.ceil(Math.random() * 1000)}`;

  const createUserCustomKey = query.post<{ email: string }>(
    "/users",
    { supervisor: takeEvery },
    function* processUsers(ctx: ApiCtx, next) {
      ctx.cache = true;
      ctx.key = theTestKey; // or some calculated key //
      yield* next();
      const buff = yield* safe(() => {
        if (!ctx.response) throw new Error("no response");
        return until(ctx.response.arrayBuffer());
      });
      if (!buff.ok) {
        throw buff.error;
      }

      const result = new TextDecoder("utf-8").decode(buff.value);
      const { users } = JSON.parse(result);
      if (!users) return;
      const curUsers = (users as User[]).reduce<Record<string, User>>(
        (acc, u) => {
          acc[u.id] = u;
          return acc;
        },
        {},
      );
      ctx.response = new Response();
      ctx.json = {
        ok: true,
        value: curUsers,
      };
    },
  );
  const newUEmail = `${mockUser.email}.org`;

  store.run(query.register);

  store.dispatch(createUserCustomKey({ email: newUEmail }));

  await store.run(() => waitForLoader(schema.loaders, createUserCustomKey));

  const expectedKey = theTestKey
    ? `/users [POST]|${theTestKey}`
    : createKey("/users [POST]", { email: newUEmail });

  const s = store.getState();
  expect(schema.cache.selectById(s, { id: expectedKey })).toEqual({
    "1": { id: "1", name: "test", email: newUEmail },
  });

  expect(expectedKey.split("|")[1]).toEqual(theTestKey);
});

test("createApi with custom key but no payload", async () => {
  const { store, schema } = testStore();
  const query = createApi();
  query.use(mdw.api({ schema }));
  query.use(query.routes());
  query.use(mdw.customKey);
  query.use(function* fetchApi(ctx, next) {
    const data = {
      users: [mockUser],
    };
    ctx.response = new Response(jsonBlob(data), { status: 200 });
    yield* next();
  });

  const theTestKey = `some-custom-key-${Math.ceil(Math.random() * 1000)}`;

  const getUsers = query.get(
    "/users",
    { supervisor: takeEvery },
    function* processUsers(ctx: ApiCtx, next) {
      ctx.cache = true;
      ctx.key = theTestKey; // or some calculated key //
      yield* next();
      const buff = yield* safe(() => {
        if (!ctx.response) throw new Error("no response");
        return until(ctx.response?.arrayBuffer());
      });
      if (!buff.ok) {
        throw buff.error;
      }

      const result = new TextDecoder("utf-8").decode(buff.value);
      const { users } = JSON.parse(result);
      if (!users) return;
      const curUsers = (users as User[]).reduce<Record<string, User>>(
        (acc, u) => {
          acc[u.id] = u;
          return acc;
        },
        {},
      );
      ctx.response = new Response();
      ctx.json = {
        ok: true,
        value: curUsers,
      };
    },
  );

  store.run(query.register);
  store.dispatch(getUsers());

  await store.run(() => waitForLoader(schema.loaders, getUsers));

  const expectedKey = theTestKey
    ? `/users [GET]|${theTestKey}`
    : createKey("/users [GET]", null);

  const s = store.getState();
  expect(schema.cache.selectById(s, { id: expectedKey })).toEqual({
    "1": mockUser,
  });

  expect(expectedKey.split("|")[1]).toBe(theTestKey);
});

test("errorHandler", () => {
  let a = 0;
  const query = createApi<ApiCtx>();
  query.use(function* errorHandler<Ctx extends ThunkCtx = ThunkCtx>(
    ctx: Ctx,
    next: Next,
  ) {
    try {
      a = 1;
      yield* next();
      a = 2;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      console.error(
        `Error: ${errorMessage}.  Check the endpoint [${ctx.name}]`,
        ctx,
      );
    }
  });
  query.use(mdw.queryCtx);
  query.use(query.routes());
  query.use(function* fetchApi(ctx, next) {
    if (`${ctx.req().url}`.startsWith("/users/")) {
      ctx.json = { ok: true, value: mockUser2 };
      yield* next();
      return;
    }
    const data = {
      users: [mockUser],
    };
    ctx.json = { ok: true, value: data };
    yield* next();
  });

  const fetchUsers = query.create(
    "/users",
    { supervisor: takeEvery },
    function* processUsers(_: ApiCtx<unknown, { users: User[] }>, next) {
      // throw new Error("some error");
      yield* next();
    },
  );

  const store = createStore({
    schemas: [createSchema()],
  });
  store.run(query.register);
  store.dispatch(fetchUsers());
  expect(store.getState()).toEqual({
    cache: {},
    loaders: {},
  });
  expect(a).toEqual(2);
});

test("stub predicate", async () => {
  let actual: { ok: boolean } = { ok: false };
  const { store, schema } = testStore();
  const api = createApi();
  api.use(function* (ctx, next) {
    ctx.stub = true;
    yield* next();
  });

  api.use(mdw.api({ schema }));
  api.use(api.routes());
  api.use(mdw.fetch({ baseUrl: "http://nowhere.com" }));

  const stub = mdw.predicate((ctx) => ctx.stub === true);

  const fetchUsers = api.get("/users", { supervisor: takeEvery }, [
    function* (ctx, next) {
      yield* next();
      actual = ctx.json;
      yield* put({ type: "DONE" });
    },
    stub(function* (ctx, next) {
      ctx.response = new Response(JSON.stringify({ frodo: "shire" }));
      yield* next();
    }),
  ]);

  store.run(api.register);
  store.dispatch(fetchUsers());

  await store.run(() =>
    waitFor(function* () {
      return actual.ok;
    }),
  );

  expect(actual).toEqual({
    ok: true,
    value: { frodo: "shire" },
  });
});
