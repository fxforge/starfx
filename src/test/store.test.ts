import {
  type Operation,
  type Result,
  createScope,
  parallel,
  put,
  sleep,
  take,
} from "../index.js";
import {
  StoreContext,
  StoreUpdateContext,
  createStore,
  updateStore,
} from "../store/index.js";
import { expect, test } from "../test.js";

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
