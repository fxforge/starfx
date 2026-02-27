import {
  API_ACTION_PREFIX,
  type ApiCtx,
  type Operation,
  call,
  createApi,
  createKey,
  keepAlive,
  mdw,
  safe,
  takeEvery,
  until,
  waitFor,
} from "../index.js";
import { useCache } from "../react.js";
import {
  createSchema,
  createStore,
  select,
  slice,
  updateStore,
  waitForLoader,
} from "../store/index.js";
import { expect, test } from "../test.js";

interface User {
  id: string;
  name: string;
  email: string;
}

const emptyUser: User = { id: "", name: "", email: "" };
const mockUser: User = { id: "1", name: "test", email: "test@test.com" };

const testStore = () => {
  const schema = createSchema({
    users: slice.table<User>({ empty: emptyUser }),
    loaders: slice.loaders(),
    cache: slice.table({ empty: {} }),
  });
  const store = createStore({ schemas: [schema] });
  return { schema, store };
};

const jsonBlob = (data: unknown) => {
  return JSON.stringify(data);
};

test("POST", async () => {
  expect.assertions(2);
  const query = createApi();
  query.use(mdw.queryCtx);
  query.use(mdw.nameParser);
  query.use(query.routes());
  query.use(function* fetchApi(ctx, next) {
    expect(ctx.req()).toEqual({
      url: "/users",
      headers: {},
      method: "POST",
      body: JSON.stringify({ email: mockUser.email }),
    });
    const data = {
      users: [mockUser],
    };

    ctx.response = new Response(jsonBlob(data), { status: 200 });

    yield* next();
  });

  const createUser = query.post<{ email: string }, { users: User[] }>(
    "/users",
    { supervisor: takeEvery },
    function* processUsers(ctx, next) {
      ctx.request = ctx.req({
        method: "POST",
        body: JSON.stringify({ email: ctx.payload.email }),
      });
      yield* next();

      const buff = yield* safe(() => {
        if (!ctx.response) throw new Error("no response");
        const res = ctx.response.arrayBuffer();
        return until(res);
      });

      if (!buff.ok) {
        throw buff.error;
      }

      const result = new TextDecoder("utf-8").decode(buff.value);
      const { users } = JSON.parse(result);
      if (!users) return;

      yield* updateStore<{ users: { [key: string]: User } }>((state) => {
        (users as User[]).forEach((u) => {
          state.users[u.id] = u;
        });
      });
    },
  );

  const schema = createSchema({
    users: slice.table<User>(),
  });
  const store = createStore({ schemas: [schema] });
  store.run(query.register);

  store.dispatch(createUser({ email: mockUser.email }));

  await store.run(() =>
    waitFor(function* (): Operation<boolean> {
      const res = yield* select((state) => state);
      return (
        (res as { users: Record<string, User> }).users["1"]?.email ===
        mockUser.email
      );
    }),
  );

  expect(store.getState().users).toEqual({
    "1": { id: "1", name: "test", email: "test@test.com" },
  });
});

test("POST with uri", () => {
  expect.assertions(1);
  const query = createApi();
  query.use(mdw.queryCtx);
  query.use(mdw.nameParser);
  query.use(query.routes());
  query.use(function* fetchApi(ctx, next) {
    expect(ctx.req()).toEqual({
      url: "/users",
      headers: {},
      method: "POST",
      body: JSON.stringify({ email: mockUser.email }),
    });

    const data = {
      users: [mockUser],
    };
    ctx.response = new Response(jsonBlob(data), { status: 200 });
    yield* next();
  });

  const userApi = query.uri("/users");
  const createUser = userApi.post<{ email: string }>(
    { supervisor: takeEvery },
    function* processUsers(
      ctx: ApiCtx<{ email: string }, { users: User[] }>,
      next,
    ) {
      ctx.request = ctx.req({
        body: JSON.stringify({ email: ctx.payload.email }),
      });

      yield* next();
      if (!ctx.json.ok) return;
      const { users } = ctx.json.value;
      yield* updateStore<{ users: { [key: string]: User } }>((state) => {
        users.forEach((u) => {
          state.users[u.id] = u;
        });
      });
    },
  );

  const store = createStore({ schemas: [createSchema()] });
  store.run(query.register);
  store.dispatch(createUser({ email: mockUser.email }));
});

test("middleware - with request fn", () => {
  expect.assertions(2);
  const query = createApi();
  query.use(mdw.queryCtx);
  query.use(mdw.nameParser);
  query.use(query.routes());
  query.use(function* (ctx, next) {
    expect(ctx.req().method).toEqual("POST");
    expect(ctx.req().url).toEqual("/users");
    yield* next();
  });
  const createUser = query.create(
    "/users",
    { supervisor: takeEvery },
    query.request({ method: "POST" }),
  );
  const store = createStore({ schemas: [createSchema()] });
  store.run(query.register);
  store.dispatch(createUser());
});

test("run() on endpoint action - should run the effect", () => {
  expect.assertions(1);
  const api = createApi<TestCtx>();
  api.use(api.routes());
  let acc = "";
  const action1 = api.get<{ id: string }, { result: boolean }>(
    "/users/:id",
    { supervisor: takeEvery },
    function* (_, next) {
      yield* next();
      acc += "a";
    },
  );
  const action2 = api.get(
    "/users2",
    { supervisor: takeEvery },
    function* (_, next) {
      yield* next();
      yield* call(() => action1.run(action1({ id: "1" })));
      acc += "b";
      expect(acc).toEqual("ab");
    },
  );

  const store = createStore({ schemas: [createSchema()] });
  store.run(api.register);
  store.dispatch(action2());
});

test("run() from a normal saga", async () => {
  expect.assertions(6);
  const api = createApi();
  api.use(api.routes());
  let acc = "";
  const action1 = api.get<{ id: string }>(
    "/users/:id",
    {
      supervisor: takeEvery,
    },
    function* (_, next) {
      yield* next();
      acc += "a";
    },
  );
  const extractedResults = {
    actionType: null,
    actionPayload: null,
    name: null,
    payload: null,
  };
  const action2 = () => ({ type: "ACTION" });
  function* onAction() {
    const ctx = yield* safe(() => action1.run(action1({ id: "1" })));
    if (!ctx.ok) {
      throw new Error("no ctx");
    }
    Object.assign(extractedResults, {
      actionType: ctx.value.action.type,
      actionPayload: ctx.value.action.payload,
      name: ctx.value.name,
      payload: ctx.value.payload,
    });
    acc += "b";
  }
  function* watchAction() {
    yield* takeEvery(action2, onAction);
  }

  const store = createStore({ schemas: [createSchema()] });
  store.run(() => keepAlive([api.register, watchAction]));
  store.dispatch(action2());

  await new Promise((resolve) => setTimeout(resolve, 300));
  const payload = { name: "/users/:id [GET]", options: { id: "1" } };

  expect(extractedResults.actionType).toEqual(`${API_ACTION_PREFIX}${action1}`);
  expect((extractedResults.actionPayload as any).name).toEqual(payload.name);
  expect((extractedResults.actionPayload as any).options).toEqual(
    payload.options,
  );
  expect(extractedResults.name).toEqual("/users/:id [GET]");
  expect(extractedResults.payload).toEqual({ id: "1" });
  expect(acc).toEqual("ab");
});

test("with hash key on a large post", async () => {
  const { store, schema } = testStore();
  const query = createApi();
  query.use(mdw.api({ schema }));
  query.use(query.routes());
  query.use(function* fetchApi(ctx, next) {
    const data = {
      users: [{ ...mockUser, ...ctx.action.payload.options }],
    };
    ctx.response = new Response(jsonBlob(data), { status: 200 });
    yield* next();
  });
  const createUserDefaultKey = query.post<{ email: string; largetext: string }>(
    "/users",
    { supervisor: takeEvery },
    function* processUsers(ctx, next) {
      ctx.cache = true;
      yield* next();
      const buff = yield* safe(() => {
        if (!ctx.response) {
          throw new Error("no response");
        }
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

  const email = `${mockUser.email}9`;
  const largetext = "abc-def-ghi-jkl-mno-pqr".repeat(100);

  store.run(query.register);
  const action = createUserDefaultKey({ email, largetext });
  store.dispatch(action);

  await store.run(() => waitForLoader(schema.loaders, action));

  const s = store.getState();
  const expectedKey = createKey(action.payload.name, {
    email,
    largetext,
  });

  expect([8, 9].includes(expectedKey.split("|")[1].length)).toBeTruthy();
  expect(s.cache[expectedKey]).toEqual({
    "1": { id: "1", name: "test", email: email, largetext: largetext },
  });
});

test("two identical endpoints", () => {
  const actual: string[] = [];
  const { store, schema } = testStore();
  const api = createApi();
  api.use(mdw.api({ schema }));
  api.use(api.routes());

  const first = api.get("/health", function* (ctx, next) {
    actual.push(ctx.req().url);
    yield* next();
  });

  const second = api.get(["/health", "poll"], function* (ctx, next) {
    actual.push(ctx.req().url);
    yield* next();
  });

  store.run(api.register);
  store.dispatch(first());
  store.dispatch(second());

  expect(actual).toEqual(["/health", "/health"]);
});

interface TestCtx<P = any, S = any> extends ApiCtx<P, S, { message: string }> {
  something: boolean;
}

// this is strictly for testing types
test("ensure types for get() endpoint", () => {
  const api = createApi<TestCtx>();
  api.use(api.routes());
  api.use(function* (ctx, next) {
    yield* next();
    const data = { result: "wow" };
    ctx.json = { ok: true, value: data };
  });

  const acc: string[] = [];
  const action1 = api.get<{ id: string }, { result: string }>(
    "/users/:id",
    { supervisor: takeEvery },
    function* (ctx, next) {
      ctx.something = false;
      acc.push(ctx.payload.id);

      yield* next();

      if (ctx.json.ok) {
        acc.push(ctx.json.value.result);
      }
    },
  );

  const store = createStore({ schemas: [createSchema()] });
  store.run(api.register);

  store.dispatch(action1({ id: "1" }));
  expect(acc).toEqual(["1", "wow"]);
});

interface FetchUserProps {
  id: string;
}
type FetchUserCtx = TestCtx<FetchUserProps>;

// this is strictly for testing types
test("ensure ability to cast `ctx` in function definition", () => {
  const api = createApi<TestCtx>();
  api.use(api.routes());
  api.use(function* (ctx, next) {
    yield* next();
    const data = { result: "wow" };
    ctx.json = { ok: true, value: data };
  });

  const acc: string[] = [];
  const action1 = api.get<FetchUserProps>(
    "/users/:id",
    { supervisor: takeEvery },
    function* (ctx: FetchUserCtx, next) {
      ctx.something = false;
      acc.push(ctx.payload.id);

      yield* next();

      if (ctx.json.ok) {
        acc.push(ctx.json.value.result);
      }
    },
  );

  const store = createStore({ schemas: [createSchema()] });
  store.run(api.register);
  store.dispatch(action1({ id: "1" }));
  expect(acc).toEqual(["1", "wow"]);
});

type FetchUserSecondCtx = TestCtx<any, { result: string }>;

// this is strictly for testing types
test("ensure ability to cast `ctx` in function definition with no props", () => {
  const api = createApi<TestCtx>();
  api.use(api.routes());
  api.use(function* (ctx, next) {
    yield* next();
    const data = { result: "wow" };
    ctx.json = { ok: true, value: data };
  });

  const acc: string[] = [];
  const action1 = api.get<never, { result: string }>(
    "/users",
    { supervisor: takeEvery },
    function* (ctx: FetchUserSecondCtx, next) {
      ctx.something = false;

      yield* next();

      if (ctx.json.ok) {
        acc.push(ctx.json.value.result);
      }
    },
  );

  const store = createStore({ schemas: [createSchema()] });
  store.run(api.register);
  store.dispatch(action1());
  expect(acc).toEqual(["wow"]);
});

test("should bubble up error", () => {
  let error: any = null;
  const { store } = testStore();
  const api = createApi();
  api.use(function* (_, next) {
    try {
      yield* next();
    } catch (err) {
      error = err;
    }
  });
  api.use(mdw.queryCtx);
  api.use(api.routes());

  const fetchUser = api.get(
    "/users/8",
    { supervisor: takeEvery },
    function* (ctx, _) {
      (ctx.loader as any).meta = { key: ctx.payload.thisKeyDoesNotExist };
      throw new Error("GENERATING AN ERROR");
    },
  );

  store.run(api.register);
  store.dispatch(fetchUser());
  expect(error.message).toBe(
    "Cannot read properties of undefined (reading 'thisKeyDoesNotExist')",
  );
});

// this is strictly for testing types
test("useCache - derive api success from endpoint", () => {
  const api = createApi<TestCtx>();
  api.use(api.routes());
  api.use(function* (ctx, next) {
    yield* next();
    const data = { result: "wow" };
    ctx.json = { ok: true, value: data };
  });

  const acc: string[] = [];
  const action1 = api.get<never, { result: string }>(
    "/users",
    { supervisor: takeEvery },
    function* (ctx, next) {
      ctx.something = false;

      yield* next();

      if (ctx.json.ok) {
        acc.push(ctx.json.value.result);
      } else {
        // EXPECT { message: string }
        ctx.json.error;
      }
    },
  );

  const store = createStore({ schemas: [createSchema()] });
  store.run(api.register);

  function _App() {
    const act = action1();
    act.payload._result;
    const users = useCache(act);
    // EXPECT { result: string } | undefined
    users.data;
  }
});
