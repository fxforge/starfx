import { sleep } from "effection";
import { Ok, type Operation, parallel, put, take } from "../index.js";
import {
  PERSIST_LOADER_ID,
  type PersistAdapter,
  createPersistor,
  createSchema,
  createStore,
  createTransform,
  persistStoreMdw,
  slice,
} from "../store/index.js";
import { expect, test } from "../test.js";
import type { LoaderItemState } from "../types.js";

test("can persist to storage adapters", async () => {
  expect.assertions(1);
  const [schema, initialState] = createSchema({
    token: slice.str(),
    loaders: slice.loaders(),
    cache: slice.table({ empty: {} }),
  });
  type State = typeof initialState;
  let ls = "{}";
  const adapter: PersistAdapter<State> = {
    getItem: function* (_: string) {
      return Ok(JSON.parse(ls));
    },
    setItem: function* (_: string, s: Partial<State>) {
      ls = JSON.stringify(s);
      return Ok(undefined);
    },
    removeItem: function* (_: string) {
      return Ok(undefined);
    },
  };
  const persistor = createPersistor<State>({ adapter, allowlist: ["token"] });
  const mdw = persistStoreMdw(persistor);
  const store = createStore({
    initialState,
    middleware: [mdw],
  });

  await store.run(function* (): Operation<void> {
    yield* persistor.rehydrate();

    const group = yield* parallel([
      function* (): Operation<void> {
        const action = yield* take<string>("SET_TOKEN");
        yield* schema.update(schema.token.set(action.payload));
      },
      function* () {
        // TODO we may need to consider how to handle this, is it a breaking change?
        yield* sleep(0);
        yield* put({ type: "SET_TOKEN", payload: "1234" });
      },
    ]);
    yield* group;
  });

  expect(ls).toBe('{"token":"1234"}');
});

test("rehydrates state", async () => {
  expect.assertions(1);
  const [schema, initialState] = createSchema({
    token: slice.str(),
    loaders: slice.loaders(),
    cache: slice.table({ empty: {} }),
  });
  type State = typeof initialState;
  let ls = JSON.stringify({ token: "123" });
  const adapter: PersistAdapter<State> = {
    getItem: function* (_: string) {
      return Ok(JSON.parse(ls));
    },
    setItem: function* (_: string, s: Partial<State>) {
      ls = JSON.stringify(s);
      return Ok(undefined);
    },
    removeItem: function* (_: string) {
      return Ok(undefined);
    },
  };
  const persistor = createPersistor<State>({ adapter, allowlist: ["token"] });
  const mdw = persistStoreMdw(persistor);
  const store = createStore({
    initialState,
    middleware: [mdw],
  });

  await store.run(function* (): Operation<void> {
    yield* persistor.rehydrate();
    yield* schema.update(schema.loaders.success({ id: PERSIST_LOADER_ID }));
  });

  expect(store.getState().token).toBe("123");
});

test("persists inbound state using transform 'in' function", async () => {
  expect.assertions(1);
  const [schema, initialState] = createSchema({
    token: slice.str(),
    loaders: slice.loaders(),
    cache: slice.table({ empty: {} }),
  });
  type State = typeof initialState;
  let ls = "{}";

  const adapter: PersistAdapter<State> = {
    getItem: function* (_: string) {
      return Ok(JSON.parse(ls));
    },
    setItem: function* (_: string, s: Partial<State>) {
      ls = JSON.stringify(s);
      return Ok(undefined);
    },
    removeItem: function* (_: string) {
      return Ok(undefined);
    },
  };

  const transform = createTransform<State>();

  transform.in = (state) => ({
    ...state,
    token: state?.token?.split("").reverse().join(""),
  });

  const persistor = createPersistor<State>({
    adapter,
    allowlist: ["token", "cache"],
    transform,
  });

  const mdw = persistStoreMdw(persistor);
  const store = createStore({
    initialState,
    middleware: [mdw],
  });

  await store.run(function* (): Operation<void> {
    yield* persistor.rehydrate();

    const group = yield* parallel([
      function* (): Operation<void> {
        const action = yield* take<string>("SET_TOKEN");
        yield* schema.update(schema.token.set(action.payload));
      },
      function* () {
        // TODO we may need to consider how to handle this, is it a breaking change?
        yield* sleep(0);
        yield* put({ type: "SET_TOKEN", payload: "1234" });
      },
    ]);
    yield* group;
  });

  expect(ls).toBe('{"token":"4321","cache":{}}');
});

test("persists inbound state using tranform in (2)", async () => {
  expect.assertions(1);
  const [schema, initialState] = createSchema({
    token: slice.str(),
    loaders: slice.loaders(),
    cache: slice.table({ empty: {} }),
  });
  type State = typeof initialState;
  let ls = "{}";

  const adapter: PersistAdapter<State> = {
    getItem: function* (_: string) {
      return Ok(JSON.parse(ls));
    },
    setItem: function* (_: string, s: Partial<State>) {
      ls = JSON.stringify(s);
      return Ok(undefined);
    },
    removeItem: function* (_: string) {
      return Ok(undefined);
    },
  };

  function revertToken(state: Partial<State>) {
    const res = {
      ...state,
      token: state?.token?.split("").reverse().join(""),
    };
    return res;
  }
  const transform = createTransform<State>();
  transform.in = revertToken;

  const persistor = createPersistor<State>({
    adapter,
    allowlist: ["token", "cache"],
    transform,
  });

  const mdw = persistStoreMdw(persistor);
  const store = createStore({
    initialState,
    middleware: [mdw],
  });

  await store.run(function* (): Operation<void> {
    yield* persistor.rehydrate();

    const group = yield* parallel([
      function* (): Operation<void> {
        const action = yield* take<string>("SET_TOKEN");
        yield* schema.update(schema.token.set(action.payload));
      },
      function* () {
        // TODO we may need to consider how to handle this, is it a breaking change?
        yield* sleep(0);
        yield* put({ type: "SET_TOKEN", payload: "1234" });
      },
    ]);
    yield* group;
  });
  expect(ls).toBe('{"token":"4321","cache":{}}');
});

test("persists a filtered nested part of a slice", async () => {
  expect.assertions(5);
  const [schema, initialState] = createSchema({
    token: slice.str(),
    loaders: slice.loaders(),
    cache: slice.table({ empty: {} }),
  });
  type State = typeof initialState;
  let ls = "{}";

  const adapter: PersistAdapter<State> = {
    getItem: function* (_: string) {
      return Ok(JSON.parse(ls));
    },
    setItem: function* (_: string, s: Partial<State>) {
      ls = JSON.stringify(s);
      return Ok(undefined);
    },
    removeItem: function* (_: string) {
      return Ok(undefined);
    },
  };

  function pickLatestOfLoadersAandC(state: Partial<State>): Partial<State> {
    const nextState = { ...state };

    if (state.loaders) {
      const maxLastRun: Record<string, number> = {};
      const entryWithMaxLastRun: Record<string, LoaderItemState<any>> = {};

      for (const entryKey in state.loaders) {
        const entry = state.loaders[entryKey] as LoaderItemState<any>;
        const sliceName = entryKey.split("[")[0].trim();
        if (sliceName.includes("A") || sliceName.includes("C")) {
          if (!maxLastRun[sliceName] || entry.lastRun > maxLastRun[sliceName]) {
            maxLastRun[sliceName] = entry.lastRun;
            entryWithMaxLastRun[sliceName] = entry;
          }
        }
      }
      nextState.loaders = entryWithMaxLastRun;
    }
    return nextState;
  }

  const transform = createTransform<State>();
  transform.in = pickLatestOfLoadersAandC;

  const persistor = createPersistor<State>({
    adapter,
    transform,
  });

  const mdw = persistStoreMdw(persistor);
  const store = createStore({
    initialState,
    middleware: [mdw],
  });

  await store.run(function* (): Operation<void> {
    yield* persistor.rehydrate();
    const group = yield* parallel([
      function* () {
        yield* schema.update(schema.token.set("1234"));
        yield* schema.update(
          schema.loaders.start({
            id: "A [POST]|1234",
            message: "loading A-first",
          }),
        );
        yield* schema.update(schema.loaders.start({ id: "B" }));
        yield* schema.update(schema.loaders.start({ id: "C" }));
        yield* schema.update(schema.loaders.success({ id: "A" }));
        yield* schema.update(schema.loaders.success({ id: "B" }));
        yield* schema.update(schema.loaders.success({ id: "C" }));
        // wait a tick to ensure ordering
        yield* sleep(0);
        yield* schema.update(
          schema.loaders.start({
            id: "A [POST]|5678",
            message: "loading A-second",
          }),
        );
        yield* schema.update(schema.loaders.start({ id: "B" }));
        yield* schema.update(schema.loaders.start({ id: "C" }));
        yield* schema.update(schema.loaders.success({ id: "A" }));
        yield* schema.update(schema.loaders.success({ id: "B" }));
        yield* schema.update(schema.loaders.success({ id: "C" }));
        yield* schema.update(schema.token.set("1"));
      },
    ]);
    yield* group;
  });
  expect(ls).toContain('{"token":"1"');
  expect(ls).toContain('"message":"loading A-second"');
  expect(ls).toContain('"id":"C"');
  expect(ls).not.toContain('"message":"loading A-first"');
  expect(ls).not.toMatch('"id":"B"');
});

test("handles the empty state correctly", async () => {
  expect.assertions(1);
  const [_schema, initialState] = createSchema({
    token: slice.str(),
    loaders: slice.loaders(),
    cache: slice.table({ empty: {} }),
  });

  type State = typeof initialState;
  let ls = "{}";

  const adapter: PersistAdapter<State> = {
    getItem: function* (_: string) {
      return Ok(JSON.parse(ls));
    },
    setItem: function* (_: string, s: Partial<State>) {
      ls = JSON.stringify(s);
      return Ok(undefined);
    },
    removeItem: function* (_: string) {
      return Ok(undefined);
    },
  };

  const transform = createTransform<State>();
  transform.in = (_: Partial<State>) => ({});

  const persistor = createPersistor<State>({
    adapter,
    transform,
  });

  const mdw = persistStoreMdw(persistor);
  const store = createStore({
    initialState,
    middleware: [mdw],
  });

  await store.run(function* (): Operation<void> {
    yield* persistor.rehydrate();
  });

  expect(ls).toBe("{}");
});

test("in absence of the inbound transformer, persists as it is", async () => {
  expect.assertions(1);
  const [schema, initialState] = createSchema({
    token: slice.str(),
    loaders: slice.loaders(),
    cache: slice.table({ empty: {} }),
  });
  type State = typeof initialState;
  let ls = "{}";
  const adapter: PersistAdapter<State> = {
    getItem: function* (_: string) {
      return Ok(JSON.parse(ls));
    },
    setItem: function* (_: string, s: Partial<State>) {
      ls = JSON.stringify(s);
      return Ok(undefined);
    },
    removeItem: function* (_: string) {
      return Ok(undefined);
    },
  };
  const persistor = createPersistor<State>({
    adapter,
    allowlist: ["token"],
    transform: createTransform<State>(), // we deliberately do not set the inbound transformer
  });

  const mdw = persistStoreMdw(persistor);
  const store = createStore({
    initialState,
    middleware: [mdw],
  });

  await store.run(function* (): Operation<void> {
    yield* persistor.rehydrate();

    const group = yield* parallel([
      function* (): Operation<void> {
        const action = yield* take<string>("SET_TOKEN");
        yield* schema.update(schema.token.set(action.payload));
      },
      function* () {
        // TODO we may need to consider how to handle this, is it a breaking change?
        yield* sleep(0);
        yield* put({ type: "SET_TOKEN", payload: "1234" });
      },
    ]);
    yield* group;
  });

  expect(ls).toBe('{"token":"1234"}');
});

test("handles errors gracefully, defaluts to identity function", async () => {
  expect.assertions(1);
  const [schema, initialState] = createSchema({
    token: slice.str(),
    loaders: slice.loaders(),
    cache: slice.table({ empty: {} }),
  });
  type State = typeof initialState;
  let ls = "{}";
  const adapter: PersistAdapter<State> = {
    getItem: function* (_: string) {
      return Ok(JSON.parse(ls));
    },
    setItem: function* (_: string, s: Partial<State>) {
      ls = JSON.stringify(s);
      return Ok(undefined);
    },
    removeItem: function* (_: string) {
      return Ok(undefined);
    },
  };

  const transform = createTransform<State>();
  transform.in = (_: Partial<State>) => {
    throw new Error("testing the transform error");
  };
  const persistor = createPersistor<State>({
    adapter,
    transform,
  });
  const mdw = persistStoreMdw(persistor);
  const store = createStore({
    initialState,
    middleware: [mdw],
  });

  const err = console.error;
  console.error = () => {};
  await store.run(function* (): Operation<void> {
    yield* persistor.rehydrate();
    yield* schema.update(schema.loaders.success({ id: PERSIST_LOADER_ID }));
    yield* schema.update(schema.token.set("1234"));
  });
  expect(store.getState().token).toBe("1234");
  console.error = err;
});

test("allowdList is filtered out after the inbound  transformer is applied", async () => {
  expect.assertions(1);
  const [schema, initialState] = createSchema({
    token: slice.str(),
    counter: slice.num(0),
    loaders: slice.loaders(),
    cache: slice.table({ empty: {} }),
  });
  type State = typeof initialState;
  let ls = "{}";
  const adapter: PersistAdapter<State> = {
    getItem: function* (_: string) {
      return Ok(JSON.parse(ls));
    },
    setItem: function* (_: string, s: Partial<State>) {
      ls = JSON.stringify(s);
      return Ok(undefined);
    },
    removeItem: function* (_: string) {
      return Ok(undefined);
    },
  };

  const transform = createTransform<State>();
  transform.in = (state) => ({
    ...state,
    token: `${state.counter}${state?.token?.split("").reverse().join("")}`,
  });

  const persistor = createPersistor<State>({
    adapter,
    allowlist: ["token"],
    transform,
  });

  const mdw = persistStoreMdw(persistor);
  const store = createStore({
    initialState,
    middleware: [mdw],
  });

  await store.run(function* (): Operation<void> {
    yield* persistor.rehydrate();
    yield* schema.update(schema.loaders.success({ id: PERSIST_LOADER_ID }));
    yield* schema.update(schema.token.set("1234"));
    yield* schema.update(schema.counter.set(5));
  });

  expect(ls).toBe('{"token":"54321"}');
});

test("the inbound transformer can be redifined during runtime", async () => {
  expect.assertions(2);
  const [schema, initialState] = createSchema({
    token: slice.str(),
    loaders: slice.loaders(),
    cache: slice.table({ empty: {} }),
  });
  type State = typeof initialState;
  let ls = "{}";
  const adapter: PersistAdapter<State> = {
    getItem: function* (_: string) {
      return Ok(JSON.parse(ls));
    },
    setItem: function* (_: string, s: Partial<State>) {
      ls = JSON.stringify(s);
      return Ok(undefined);
    },
    removeItem: function* (_: string) {
      return Ok(undefined);
    },
  };

  const transform = createTransform<State>();
  transform.in = (state) => ({
    ...state,
    token: `${state?.token?.split("").reverse().join("")}`,
  });

  const persistor = createPersistor<State>({
    adapter,
    allowlist: ["token"],
    transform,
  });

  const mdw = persistStoreMdw(persistor);
  const store = createStore({
    initialState,
    middleware: [mdw],
  });

  await store.run(function* (): Operation<void> {
    yield* persistor.rehydrate();
    yield* schema.update(schema.loaders.success({ id: PERSIST_LOADER_ID }));
    yield* schema.update(schema.token.set("01234"));
  });

  expect(ls).toBe('{"token":"43210"}');

  transform.in = (state) => ({
    ...state,
    token: `${state?.token}56789`,
  });

  await store.run(function* (): Operation<void> {
    yield* schema.update(schema.token.set("01234"));
  });

  expect(ls).toBe('{"token":"0123456789"}');
});

test("persists state using transform 'out' function", async () => {
  expect.assertions(1);
  const [schema, initialState] = createSchema({
    token: slice.str(),
    counter: slice.num(0),
    loaders: slice.loaders(),
    cache: slice.table({ empty: {} }),
  });
  type State = typeof initialState;
  let ls = '{"token": "01234"}';

  const adapter: PersistAdapter<State> = {
    getItem: function* (_: string) {
      return Ok(JSON.parse(ls));
    },
    setItem: function* (_: string, s: Partial<State>) {
      ls = JSON.stringify(s);
      return Ok(undefined);
    },
    removeItem: function* (_: string) {
      return Ok(undefined);
    },
  };

  function revertToken(state: Partial<State>) {
    return { ...state, token: state?.token?.split("").reverse().join("") };
  }
  const transform = createTransform<State>();
  transform.out = revertToken;

  const persistor = createPersistor<State>({
    adapter,
    allowlist: ["token"],
    transform,
  });

  const mdw = persistStoreMdw(persistor);
  const store = createStore({
    initialState,
    middleware: [mdw],
  });

  await store.run(function* (): Operation<void> {
    yield* persistor.rehydrate();
    yield* schema.update(schema.loaders.success({ id: PERSIST_LOADER_ID }));
  });

  expect(store.getState().token).toBe("43210");
});

test("persists outbound state using tranform setOutTransformer", async () => {
  expect.assertions(1);
  const [schema, initialState] = createSchema({
    token: slice.str(),
    counter: slice.num(0),
    loaders: slice.loaders(),
    cache: slice.table({ empty: {} }),
  });
  type State = typeof initialState;
  let ls = '{"token": "43210"}';

  const adapter: PersistAdapter<State> = {
    getItem: function* (_: string) {
      return Ok(JSON.parse(ls));
    },
    setItem: function* (_: string, s: Partial<State>) {
      ls = JSON.stringify(s);
      return Ok(undefined);
    },
    removeItem: function* (_: string) {
      return Ok(undefined);
    },
  };

  function revertToken(state: Partial<State>) {
    return {
      ...state,
      token: ["5"]
        .concat(...(state?.token?.split("") || []))
        .reverse()
        .join(""),
    };
  }
  const transform = createTransform<State>();
  transform.out = revertToken;

  const persistor = createPersistor<State>({
    adapter,
    allowlist: ["token"],
    transform,
  });

  const mdw = persistStoreMdw(persistor);
  const store = createStore({
    initialState,
    middleware: [mdw],
  });

  await store.run(function* (): Operation<void> {
    yield* persistor.rehydrate();
    yield* schema.update(schema.loaders.success({ id: PERSIST_LOADER_ID }));
  });

  expect(ls).toBe('{"token":"012345"}');
});

test("persists outbound a filtered nested part of a slice", async () => {
  expect.assertions(1);
  const [schema, initialState] = createSchema({
    token: slice.str(),
    loaders: slice.loaders(),
    cache: slice.table({ empty: {} }),
  });
  type State = typeof initialState;
  let ls =
    '{"loaders":{"A":{"id":"A [POST]|5678","status":"loading","message":"loading A-second","lastRun":1725048721168,"lastSuccess":0,"meta":{"flag":"01234_FLAG_PERSISTED"}}}}';

  const adapter: PersistAdapter<State> = {
    getItem: function* (_: string) {
      return Ok(JSON.parse(ls));
    },
    setItem: function* (_: string, s: Partial<State>) {
      ls = JSON.stringify(s);
      return Ok(undefined);
    },
    removeItem: function* (_: string) {
      return Ok(undefined);
    },
  };

  function extractMetaAndSetToken(state: Partial<State>): Partial<State> {
    const nextState = { ...state };
    if (state.loaders) {
      const savedLoader = state.loaders.A;
      if (savedLoader?.meta?.flag) {
        nextState.token = savedLoader.meta.flag;
      }
    }
    return nextState;
  }

  const transform = createTransform<State>();
  transform.out = extractMetaAndSetToken;

  const persistor = createPersistor<State>({
    adapter,
    transform,
  });

  const mdw = persistStoreMdw(persistor);
  const store = createStore({
    initialState,
    middleware: [mdw],
  });

  await store.run(function* (): Operation<void> {
    yield* persistor.rehydrate();
    yield* schema.update(schema.loaders.success({ id: PERSIST_LOADER_ID }));
  });
  expect(store.getState().token).toBe("01234_FLAG_PERSISTED");
});

test("the outbound transformer can be reset during runtime", async () => {
  expect.assertions(3);
  const [schema, initialState] = createSchema({
    token: slice.str(),
    counter: slice.num(0),
    loaders: slice.loaders(),
    cache: slice.table({ empty: {} }),
  });
  type State = typeof initialState;
  let ls = '{"token": "_1234"}';

  const adapter: PersistAdapter<State> = {
    getItem: function* (_: string) {
      return Ok(JSON.parse(ls));
    },
    setItem: function* (_: string, s: Partial<State>) {
      ls = JSON.stringify(s);
      return Ok(undefined);
    },
    removeItem: function* (_: string) {
      return Ok(undefined);
    },
  };

  function revertToken(state: Partial<State>) {
    return { ...state, token: state?.token?.split("").reverse().join("") };
  }
  function postpendToken(state: Partial<State>) {
    return {
      ...state,
      token: `${state?.token}56789`,
    };
  }
  const transform = createTransform<State>();
  transform.out = revertToken;

  const persistor = createPersistor<State>({
    adapter,
    allowlist: ["token"],
    transform,
  });

  const mdw = persistStoreMdw(persistor);
  const store = createStore({
    initialState,
    middleware: [mdw],
  });

  await store.run(function* (): Operation<void> {
    yield* persistor.rehydrate();
    yield* schema.update(schema.loaders.success({ id: PERSIST_LOADER_ID }));
  });

  expect(store.getState().token).toBe("4321_");

  await store.run(function* (): Operation<void> {
    yield* schema.update(schema.token.set("01234"));
  });

  expect(ls).toBe('{"token":"01234"}');

  transform.out = postpendToken;

  await store.run(function* (): Operation<void> {
    yield* persistor.rehydrate();
    yield* schema.update(schema.loaders.success({ id: PERSIST_LOADER_ID }));
  });

  expect(store.getState().token).toBe("0123456789");
});
