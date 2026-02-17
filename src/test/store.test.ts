import {
  type Operation,
  type Result,
  createScope,
  createThunks,
  parallel,
  put,
  resource,
  sleep,
  take,
} from "../index.js";
import {
  StoreContext,
  StoreUpdateContext,
  createStore,
  updateStore,
} from "../store/index.js";
import { describe, expect, test } from "../test.js";

interface User {
  id: string;
  name: string;
}

interface State {
  users: { [key: string]: User };
  theme: string;
  token: string;
  dev: boolean;
}

function findUserById(state: State, { id }: { id: string }) {
  return state.users[id];
}

function findUsers(state: State) {
  return state.users;
}

interface UpdateUserProps {
  id: string;
  name: string;
}

const updateUser =
  ({ id, name }: UpdateUserProps) =>
  (state: State) => {
    // use selectors to find the data you want to mutate
    const user = findUserById(state, { id });
    user.name = name;

    // different ways to update a `zod` record
    const users = findUsers(state);
    users[id].name = name;

    (users as any)[2] = undefined;
    users[3] = { id: "", name: "" };

    // or mutate state directly without selectors
    state.dev = true;
  };

test("update store and receives update from channel `StoreUpdateContext`", async () => {
  expect.assertions(1);
  const [scope] = createScope();
  const initialState: Partial<State> = {
    users: { 1: { id: "1", name: "testing" }, 2: { id: "2", name: "wow" } },
    dev: false,
  };
  createStore({ scope, initialState });
  let store;
  await scope.run(function* (): Operation<Result<void>[]> {
    const result = yield* parallel([
      function* () {
        store = yield* StoreContext.expect();
        const chan = yield* StoreUpdateContext.expect();
        const msgList = yield* chan;
        yield* msgList.next();
      },
      function* () {
        // TODO we may need to consider how to handle this, is it a breaking change?
        yield* sleep(0);
        yield* updateStore(updateUser({ id: "1", name: "eric" }));
      },
    ]);
    return yield* result;
  });
  expect((store as any)?.getState()).toEqual({
    users: { 1: { id: "1", name: "eric" }, 3: { id: "", name: "" } },
    dev: true,
  });
});

test("update store and receives update from `subscribe()`", async () => {
  expect.assertions(1);
  const initialState: Partial<State> = {
    users: { 1: { id: "1", name: "testing" }, 2: { id: "2", name: "wow" } },
    dev: false,
    theme: "",
    token: "",
  };
  const store = createStore({ initialState });

  store.subscribe(() => {
    expect(store.getState()).toEqual({
      users: { 1: { id: "1", name: "eric" }, 3: { id: "", name: "" } },
      dev: true,
      theme: "",
      token: "",
    });
  });

  await store.run(function* () {
    yield* updateStore(updateUser({ id: "1", name: "eric" }));
  });
});

test("emit Action and update store", async () => {
  expect.assertions(1);
  const initialState: Partial<State> = {
    users: { 1: { id: "1", name: "testing" }, 2: { id: "2", name: "wow" } },
    dev: false,
    theme: "",
    token: "",
  };
  const store = createStore({ initialState });

  await store.run(function* (): Operation<void> {
    const result = yield* parallel([
      function* (): Operation<void> {
        const action = yield* take<UpdateUserProps>("UPDATE_USER");
        yield* updateStore(updateUser(action.payload));
      },
      function* () {
        // TODO we may need to consider how to handle this, is it a breaking change?
        yield* sleep(0);
        yield* put({ type: "UPDATE_USER", payload: { id: "1", name: "eric" } });
      },
    ]);
    yield* result;
  });

  expect(store.getState()).toEqual({
    users: { 1: { id: "1", name: "eric" }, 3: { id: "", name: "" } },
    theme: "",
    token: "",
    dev: true,
  });
});

test("resets store", async () => {
  expect.assertions(2);
  const initialState: Partial<State> = {
    users: { 1: { id: "1", name: "testing" }, 2: { id: "2", name: "wow" } },
    dev: false,
    theme: "",
    token: "",
  };
  const store = createStore({ initialState });

  await store.run(function* () {
    yield* store.update((s) => {
      s.users = { 3: { id: "3", name: "hehe" } };
      s.dev = true;
      s.theme = "darkness";
    });
  });

  expect(store.getState()).toEqual({
    users: { 3: { id: "3", name: "hehe" } },
    theme: "darkness",
    token: "",
    dev: true,
  });

  await store.run(() => store.reset(["users"]));

  expect(store.getState()).toEqual({
    users: { 3: { id: "3", name: "hehe" } },
    dev: false,
    theme: "",
    token: "",
  });
});

describe(".manage", () => {
  function guessAge(): Operation<{ guess: number; cumulative: null | number }> {
    return resource(function* (provide) {
      let cumulative = 0 as null | number;
      try {
        yield* provide({
          get guess() {
            const random = Math.floor(Math.random() * 100);
            if (cumulative !== null) cumulative += random;
            return random;
          },
          get cumulative() {
            return cumulative;
          },
        });
      } finally {
        cumulative = null;
      }
    });
  }

  test("expects resource", async () => {
    expect.assertions(1);

    const thunk = createThunks();
    thunk.use(thunk.routes());
    const store = createStore({ initialState: {} });
    const TestContext = store.manage("test:context", guessAge());
    store.initialize(thunk.register);
    let acc = "bla";
    const action = thunk.create("/users", function* (payload, next) {
      const c = yield* TestContext.get();
      if (c) acc += "b";
      next();
    });
    store.dispatch(action());

    expect(acc).toBe("blab");
  });

  test("uses resource", async () => {
    expect.assertions(2);

    const thunk = createThunks();
    thunk.use(thunk.routes());
    const store = createStore({ initialState: {} });
    const TestContext = store.manage("test:context", guessAge());
    store.initialize(thunk.register);
    let guess = 0;
    let acc = 0;
    const action = thunk.create("/users", function* (payload, next) {
      const c = yield* TestContext.expect();
      guess += c.guess;
      acc += c.cumulative ?? 0;
      next();
    });
    store.dispatch(action());

    expect(guess).toBeGreaterThan(0);
    expect(acc).toEqual(guess);
  });
});
