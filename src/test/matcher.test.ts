import {
  type ThunkCtx,
  createAction,
  createThunks,
  sleep,
  takeLatest,
} from "../index.js";
import { matcher } from "../matcher.js";
import { createStore } from "../store/index.js";
import { expect, test } from "../test.js";

test("true", () => {
  expect(true).toBe(true);
});

// The main thing
test("createAction should not match all actions", async () => {
  expect.assertions(1);

  const store = createStore({ initialState: {} });
  const matchedActions: string[] = [];

  const testAction = createAction("test/action");

  function* testFn(action: any) {
    matchedActions.push(action.type);
  }

  function* root() {
    yield* takeLatest(testAction, testFn);
  }
  const task = store.run(root);

  store.dispatch({ type: "test/action", payload: { MenuOpened: "test" } });
  store.dispatch({ type: "store", payload: { something: "else" } });
  store.dispatch({ type: "other/action", payload: { data: "test" } });

  await new Promise((resolve) => setTimeout(resolve, 100));
  expect(matchedActions).toEqual(["test/action"]);
  await task.halt();
});

test("matcher should correctly identify createAction functions", () => {
  expect.assertions(2);

  const actionCreator = createAction("test/action");
  const match = matcher(actionCreator);
  expect(match({ type: "test/action", payload: {} })).toBe(true);
  expect(match({ type: "other/action", payload: {} })).toBe(false);
});

test("typed createAction should work with takeLatest without type casting", async () => {
  expect.assertions(1);

  const store = createStore({ initialState: {} });
  const matchedActions: string[] = [];

  //typed action creator - this should work without 'as any'
  const typedAction = createAction<{ MenuOpened: string }>("TYPED_ACTION");

  function* handler(action: any) {
    matchedActions.push(action.type);
  }

  function* root() {
    // Should compile without TypeScript errors - no 'as any' needed
    yield* takeLatest(typedAction, handler);
  }

  const task = store.run(root);

  // dispatch the typed action
  store.dispatch(typedAction({ MenuOpened: "settings" }));

  // unrelated actions that should NOT trigger handler
  store.dispatch({ type: "RANDOM_ACTION", payload: { data: "test" } });

  await new Promise((resolve) => setTimeout(resolve, 100));
  expect(matchedActions).toEqual(["TYPED_ACTION"]);

  await task.halt();
});

test("should correctly identify starfx thunk as a thunk", async () => {
  expect.assertions(6);

  const thunks = createThunks();
  thunks.use(thunks.routes());

  const store = createStore({
    initialState: {
      users: {},
    },
  });
  store.run(thunks.register);

  const myThunk = thunks.create("my-thunk", function* (_ctx, next) {
    yield* next();
  });

  // Test that thunk has the expected properties for isThunk detection
  expect(typeof myThunk.run).toBe("function");
  expect(typeof myThunk.use).toBe("function");
  expect(typeof myThunk.name).toBe("string");
  expect(typeof myThunk.toString).toBe("function");

  // Verify it does NOT have the _starfx property (that's for action creators)
  expect((myThunk as any)._starfx).toBeUndefined();

  // Verify it does NOT have a key property directly on the function
  expect(typeof (myThunk as any).key).toBe("undefined");

  await new Promise((resolve) => setTimeout(resolve, 10));
});

test("matcher should correctly identify thunk functions", async () => {
  expect.assertions(3);

  const thunks = createThunks();
  thunks.use(thunks.routes());

  const store = createStore({
    initialState: {
      users: {},
    },
  });
  store.run(thunks.register);

  const myThunk = thunks.create("my-thunk", function* (_ctx, next) {
    yield* next();
  });

  // Test that the matcher correctly identifies the thunk
  const match = matcher(myThunk);
  expect(match({ type: "my-thunk", payload: {} })).toBe(true);
  expect(match({ type: "other-action", payload: {} })).toBe(false);

  // Verify the thunk's toString method returns the correct type
  expect(myThunk.toString()).toBe("my-thunk");

  await new Promise((resolve) => setTimeout(resolve, 10));
});

// the bug that determined we needed to write this matcher
test("some bug: createAction incorrectly matching all actions", async () => {
  expect.assertions(1);

  const store = createStore({ initialState: {} });
  const matchedActions: string[] = [];

  const testAction = createAction<{ MenuOpened: any }>("ACTION");

  // Create a saga that should only respond to this specific action
  function* testFn(action: any) {
    matchedActions.push(action.type);
  }

  function* root() {
    yield* takeLatest(testAction, testFn);
  }

  const task = store.run(root);

  store.dispatch(testAction({ MenuOpened: "first" }));
  store.dispatch({ type: "store", payload: { something: "else" } });
  store.dispatch({ type: "other/action", payload: { data: "test" } });

  await new Promise((resolve) => setTimeout(resolve, 100));

  expect(matchedActions).toEqual(["ACTION"]);

  await task.halt();
});

test("should show the difference between createAction and thunk properties", () => {
  expect.assertions(8);

  // starfx createAction
  const actionCreator = createAction<{ test: string }>("test/action");

  // starfx thunk
  const thunks = createThunks();
  const myThunk = thunks.create("test-thunk", function* (_ctx: ThunkCtx, next) {
    yield* next();
  });

  // Check properties of createAction
  expect(typeof actionCreator).toBe("function");
  expect(typeof actionCreator.toString).toBe("function");
  expect(actionCreator.toString()).toBe("test/action");
  expect(typeof (actionCreator as any).run).toBe("undefined"); // createAction doesn't have run

  // Check properties of thunk
  expect(typeof myThunk).toBe("function");
  expect(typeof myThunk.toString).toBe("function");
  expect(typeof myThunk.run).toBe("function"); // thunk has run
  expect(typeof myThunk.name).toBe("string"); // actionFn
});

test("debug: what path does createAction take in matcher", async () => {
  expect.assertions(7);

  const actionCreator = createAction<{ test: string }>("test/action");

  // Check that createAction has the _starfx branding property
  expect((actionCreator as any)._starfx).toBe(true);

  // Verify it's NOT identified as a thunk (should fail isThunk checks)
  const hasRun = typeof (actionCreator as any).run === "function";
  const hasUse = typeof (actionCreator as any).use === "function";
  const hasKey = typeof (actionCreator as any).key === "string";
  expect(hasRun).toBe(false);
  expect(hasUse).toBe(false);
  expect(hasKey).toBe(false);

  // Verify it has the properties needed for isActionCreator path
  const hasToString = typeof actionCreator.toString === "function";
  const isFunction = typeof actionCreator === "function";
  expect(hasToString).toBe(true);
  expect(isFunction).toBe(true);

  // Most importantly: verify the matcher correctly identifies it as an action creator
  const match = matcher(actionCreator);
  expect(match({ type: "test/action", payload: { test: "value" } })).toBe(true);

  await new Promise((resolve) => setTimeout(resolve, 10));
});
