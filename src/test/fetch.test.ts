import nock from "nock";
import { type ApiCtx, createApi, mdw, sleep, takeEvery } from "../index.js";
import {
  createSchema,
  createStore,
  slice,
  waitForLoader,
  waitForLoaders,
} from "../store/index.js";
import { expect, test } from "../test.js";

const baseUrl = "https://starfx.com";
const mockUser = { id: "1", email: "test@starfx.com" };

const testStore = () => {
  const [schema, initialState] = createSchema({
    loaders: slice.loaders(),
    cache: slice.table({ empty: {} }),
  });
  const store = createStore({ initialState });
  return { schema, store };
};

const getTestData = (ctx: ApiCtx) => {
  return { request: { ...ctx.req() }, json: { ...ctx.json } };
};

test("should be able to fetch a resource and save automatically", async () => {
  nock(baseUrl).get("/users").reply(200, mockUser);

  const { store, schema } = testStore();
  const api = createApi();
  api.use(mdw.api({ schema }));
  api.use(api.routes());
  api.use(mdw.headers);
  api.use(mdw.fetch({ baseUrl }));

  const actual: any[] = [];
  const fetchUsers = api.get(
    "/users",
    { supervisor: takeEvery },
    function* (ctx, next) {
      ctx.cache = true;
      yield* next();

      actual.push(ctx.request);
      actual.push(ctx.json);
    },
  );

  store.run(api.register);

  const action = fetchUsers();
  store.dispatch(action);

  await store.run(() => waitForLoader(schema.loaders, action));

  const state = store.getState();
  expect(state.cache[action.payload.key]).toEqual(mockUser);
  expect(actual).toEqual([
    {
      url: `${baseUrl}/users`,
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    },
    { ok: true, value: mockUser },
  ]);
});

test("should be able to fetch a resource and parse as text instead of json", async () => {
  nock(baseUrl).get("/users").reply(200, "this is some text");

  const { store, schema } = testStore();
  const api = createApi();
  api.use(mdw.api({ schema }));
  api.use(api.routes());
  api.use(mdw.fetch({ baseUrl }));

  let actual = null;
  const fetchUsers = api.get(
    "/users",
    { supervisor: takeEvery },
    function* (ctx, next) {
      ctx.cache = true;
      ctx.bodyType = "text";
      yield* next();
      actual = ctx.json;
    },
  );

  store.run(api.register);

  const action = fetchUsers();
  store.dispatch(action);

  await store.run(() => waitForLoader(schema.loaders, action));

  const data = "this is some text";
  expect(actual).toEqual({ ok: true, value: data });
});

test("error handling", async () => {
  const errMsg = { message: "something happened" };
  nock(baseUrl).get("/users").reply(500, errMsg);

  const { schema, store } = testStore();
  const api = createApi();
  api.use(mdw.api({ schema }));
  api.use(api.routes());
  api.use(mdw.fetch({ baseUrl }));

  let actual = null;
  const fetchUsers = api.get(
    "/users",
    { supervisor: takeEvery },
    function* (ctx, next) {
      ctx.cache = true;
      yield* next();

      actual = ctx.json;
    },
  );

  store.run(api.register);

  const action = fetchUsers();
  store.dispatch(action);

  await store.run(() => waitForLoader(schema.loaders, action));

  const state = store.getState();
  expect(state.cache[action.payload.key]).toEqual(errMsg);
  expect(actual).toEqual({ ok: false, error: errMsg });
});

test("status 204", async () => {
  nock(baseUrl).get("/users").reply(204);

  const { schema, store } = testStore();
  const api = createApi();
  api.use(mdw.api({ schema }));
  api.use(api.routes());
  api.use(function* (ctx, next) {
    const url = ctx.req().url;
    ctx.request = ctx.req({ url: `${baseUrl}${url}` });
    yield* next();
  });
  api.use(mdw.fetch());

  let actual = null;
  const fetchUsers = api.get(
    "/users",
    { supervisor: takeEvery },
    function* (ctx, next) {
      ctx.cache = true;
      yield* next();
      actual = ctx.json;
    },
  );

  store.run(api.register);

  const action = fetchUsers();
  store.dispatch(action);

  await store.run(() => waitForLoader(schema.loaders, action));

  const state = store.getState();
  expect(state.cache[action.payload.key]).toEqual({});
  expect(actual).toEqual({ ok: true, value: {} });
});

test("malformed json", async () => {
  nock(baseUrl).get("/users").reply(200, "not json");

  const { schema, store } = testStore();
  const api = createApi();
  api.use(mdw.api({ schema }));
  api.use(api.routes());
  api.use(function* (ctx, next) {
    const url = ctx.req().url;
    ctx.request = ctx.req({ url: `${baseUrl}${url}` });
    yield* next();
  });
  api.use(mdw.fetch());

  let actual = null;
  const fetchUsers = api.get(
    "/users",
    { supervisor: takeEvery },
    function* (ctx, next) {
      ctx.cache = true;
      yield* next();

      actual = ctx.json;
    },
  );

  store.run(api.register);
  const action = fetchUsers();
  store.dispatch(action);

  await store.run(() => waitForLoader(schema.loaders, action));

  const data = {
    message: "Unexpected token 'o', \"not json\" is not valid JSON",
  };
  expect(actual).toEqual({
    ok: false,
    error: data,
  });
});

test("POST", async () => {
  nock(baseUrl).post("/users").reply(200, mockUser);

  const { schema, store } = testStore();
  const api = createApi();
  api.use(mdw.api({ schema }));
  api.use(api.routes());
  api.use(mdw.headers);
  api.use(mdw.fetch({ baseUrl }));

  const fetchUsers = api.post(
    "/users",
    { supervisor: takeEvery },
    function* (ctx, next) {
      ctx.cache = true;
      ctx.request = ctx.req({
        body: JSON.stringify(mockUser),
      });
      yield* next();

      ctx.loader = { meta: getTestData(ctx) };
    },
  );

  store.run(api.register);
  const action = fetchUsers();
  store.dispatch(action);

  const loader = await store.run(() => waitForLoader(schema.loaders, action));
  if (!loader.ok) {
    throw loader.error;
  }

  expect(loader.value.meta.request).toEqual({
    url: `${baseUrl}/users`,
    headers: {
      "Content-Type": "application/json",
    },
    method: "POST",
    body: JSON.stringify(mockUser),
  });

  expect(loader.value.meta.json).toEqual({
    ok: true,
    value: mockUser,
  });
});

test("POST multiple endpoints with same uri", async () => {
  nock(baseUrl).post("/users/1/something").reply(200, mockUser).persist();

  const { store, schema } = testStore();
  const api = createApi();
  api.use(mdw.api({ schema }));
  api.use(api.routes());
  api.use(mdw.headers);
  api.use(mdw.fetch({ baseUrl }));

  const fetchUsers = api.post<{ id: string }>(
    "/users/:id/something",
    { supervisor: takeEvery },
    function* (ctx, next) {
      ctx.cache = true;
      ctx.request = ctx.req({ body: JSON.stringify(mockUser) });
      yield* next();

      ctx.loader = { meta: getTestData(ctx) };
    },
  );

  const fetchUsersSecond = api.post<{ id: string }>(
    ["/users/:id/something", "next"],
    { supervisor: takeEvery },
    function* (ctx, next) {
      ctx.cache = true;
      ctx.request = ctx.req({ body: JSON.stringify(mockUser) });
      yield* next();
      ctx.loader = { meta: getTestData(ctx) };
    },
  );

  store.run(api.register);

  const action1 = fetchUsers({ id: "1" });
  const action2 = fetchUsersSecond({ id: "1" });
  store.dispatch(action1);
  store.dispatch(action2);

  const results = await store.run(function* () {
    // it seems to fire the second action before it has subscribed, wait a tick
    // since this is more than ensuring an order by controlling with an async point
    // we need to sleep for 10 instead of 0
    yield* sleep(10);
    return yield* waitForLoaders(schema.loaders, [action1, action2]);
  });
  if (!results.ok) {
    throw results.error;
  }
  const result1 = results.value[0];
  if (!result1.ok) {
    throw result1.error;
  }
  const result2 = results.value[1];
  if (!result2.ok) {
    throw result2.error;
  }

  expect(result1.value.meta.request).toEqual({
    url: `${baseUrl}/users/1/something`,
    headers: {
      "Content-Type": "application/json",
    },
    method: "POST",
    body: JSON.stringify(mockUser),
  });

  expect(result1.value.meta.json).toEqual({
    ok: true,
    value: mockUser,
  });

  expect(result2.value.meta.request).toEqual({
    url: `${baseUrl}/users/1/something`,
    headers: {
      "Content-Type": "application/json",
    },
    method: "POST",
    body: JSON.stringify(mockUser),
  });

  expect(result2.value.meta.json).toEqual({
    ok: true,
    value: mockUser,
  });
});

test("slug in url but payload has empty string for slug value", () => {
  const { store, schema } = testStore();
  const api = createApi();
  api.use(mdw.api({ schema }));
  api.use(api.routes());
  api.use(mdw.fetch({ baseUrl }));
  let actual = "";

  const fetchUsers = api.post<{ id: string }>(
    "/users/:id",
    { supervisor: takeEvery },
    function* (ctx, next) {
      ctx.cache = true;
      ctx.request = ctx.req({ body: JSON.stringify(mockUser) });

      yield* next();
      if (!ctx.json.ok) {
        actual = ctx.json.error;
      }
    },
  );

  store.run(api.register);
  const action = fetchUsers({ id: "" });
  store.dispatch(action);

  const data =
    "found :id in endpoint name (/users/:id [POST]) but payload has falsy value ()";
  expect(actual).toEqual(data);
});

test("with success - should keep retrying fetch request", async () => {
  nock(baseUrl)
    .get("/users")
    .reply(400, { message: "error" })
    .get("/users")
    .reply(400, { message: "error" })
    .get("/users")
    .reply(400, { message: "error" })
    .get("/users")
    .reply(200, mockUser);

  const { schema, store } = testStore();
  const api = createApi();
  api.use(mdw.api({ schema }));
  api.use(api.routes());
  api.use(mdw.fetch({ baseUrl }));

  let actual = null;
  const fetchUsers = api.get("/users", { supervisor: takeEvery }, [
    function* (ctx, next) {
      ctx.cache = true;
      yield* next();

      if (!ctx.json.ok) {
        return;
      }

      actual = ctx.json;
    },
    mdw.fetchRetry((n) => (n > 4 ? -1 : 10)),
  ]);

  store.run(api.register);

  const action = fetchUsers();
  store.dispatch(action);

  const loader = await store.run(() => waitForLoader(schema.loaders, action));
  if (!loader.ok) {
    throw loader.error;
  }

  const state = store.getState();
  expect(state.cache[action.payload.key]).toEqual(mockUser);
  expect(actual).toEqual({ ok: true, value: mockUser });
});

test("fetch retry - with failure - should keep retrying and then quit", async () => {
  expect.assertions(1);
  nock(baseUrl).get("/users").reply(400, { message: "error" }).persist();

  const { schema, store } = testStore();
  let actual = null;
  const api = createApi();
  api.use(mdw.api({ schema }));
  api.use(api.routes());
  api.use(mdw.fetch({ baseUrl }));

  const fetchUsers = api.get("/users", { supervisor: takeEvery }, [
    function* (ctx, next) {
      ctx.cache = true;
      yield* next();
      actual = ctx.json;
    },
    mdw.fetchRetry((n) => (n > 2 ? -1 : 10)),
  ]);

  store.run(api.register);
  const action = fetchUsers();
  store.dispatch(action);

  const loader = await store.run(() => waitForLoader(schema.loaders, action));
  if (!loader.ok) {
    throw loader.error;
  }
  const data = { message: "error" };
  expect(actual).toEqual({ ok: false, error: data });
});

test("should *not* make http request and instead simply mock response", async () => {
  const { schema, store } = testStore();
  let actual = null;
  const api = createApi();
  api.use(mdw.api({ schema }));
  api.use(api.routes());
  api.use(mdw.fetch({ baseUrl }));

  const fetchUsers = api.get("/users", { supervisor: takeEvery }, [
    function* (ctx, next) {
      yield* next();
      actual = ctx.json;
    },
    mdw.response(new Response(JSON.stringify(mockUser))),
  ]);

  store.run(api.register);
  store.dispatch(fetchUsers());

  const loader = await store.run(() =>
    waitForLoader(schema.loaders, fetchUsers),
  );
  if (!loader.ok) {
    throw loader.error;
  }
  expect(actual).toEqual({ ok: true, value: mockUser });
});

test("should use dynamic mdw to mock response", async () => {
  const { schema, store } = testStore();
  let actual = null;
  const api = createApi();
  api.use(mdw.api({ schema }));
  api.use(api.routes());
  api.use(mdw.fetch({ baseUrl }));

  const fetchUsers = api.get("/users", { supervisor: takeEvery }, [
    function* (ctx, next) {
      yield* next();
      actual = ctx.json;
    },
    mdw.response(new Response(JSON.stringify(mockUser))),
  ]);

  store.run(api.register);

  // override default response with dynamic mdw
  const dynamicUser = { id: "2", email: "dynamic@starfx.com" };
  fetchUsers.use(mdw.response(new Response(JSON.stringify(dynamicUser))));
  store.dispatch(fetchUsers());
  let loader = await store.run(() => waitForLoader(schema.loaders, fetchUsers));
  if (!loader.ok) {
    throw loader.error;
  }
  expect(actual).toEqual({ ok: true, value: dynamicUser });

  // reset dynamic mdw and try again
  api.reset();
  store.dispatch(fetchUsers());
  loader = await store.run(() => waitForLoader(schema.loaders, fetchUsers));
  if (!loader.ok) {
    throw loader.error;
  }
  expect(actual).toEqual({ ok: true, value: mockUser });
});
