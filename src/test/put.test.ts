import { ActionContext, each, put, sleep, spawn, take } from "../index.js";
import { createSchema, createStore } from "../store/index.js";
import { expect, test } from "../test.js";

test("should send actions through channel", async () => {
  const actual: string[] = [];

  function* genFn(arg: string) {
    const actions = yield* ActionContext.expect();
    const task = yield* spawn(function* () {
      for (const action of yield* each(actions)) {
        actual.push(action.type);
        yield* each.next();
      }
    });
    // sleep to progress the spawned task
    yield* sleep(0);

    yield* put({
      type: arg,
    });
    yield* put({
      type: "2",
    });
    actions.close();
    yield* task;
  }

  const store = createStore({ schemas: [createSchema()] });
  await store.run(() => genFn("arg"));

  const expected = ["arg", "2"];
  expect(actual).toEqual(expected);
});

test("should handle nested puts", async () => {
  const actual: string[] = [];

  function* genA() {
    yield* put({
      type: "a",
    });
    actual.push("put a");
  }

  function* genB() {
    yield* take(["a"]);
    yield* put({
      type: "b",
    });
    actual.push("put b");
  }

  function* root() {
    // sleep to progress each spawned task
    yield* spawn(genB);
    yield* sleep(0);
    yield* spawn(genA);
    yield* sleep(0);
  }

  const store = createStore({ schemas: [createSchema()] });
  await store.run(() => root());

  // TODO, was this backwards? we are using `take("a")` in `genB`, so it will wait for `genA` to finish
  const expected = ["put a", "put b"];
  expect(actual).toEqual(expected);
});

test("should not cause stack overflow when puts are emitted while dispatching saga", async () => {
  function* root() {
    for (let i = 0; i < 10_000; i += 1) {
      yield* put({ type: "test" });
    }
  }

  const store = createStore({ schemas: [createSchema()] });
  await store.run(root);
  expect(true).toBe(true);
});

test("should not miss `put` that was emitted directly after creating a task (caused by another `put`)", async () => {
  const actual: string[] = [];

  function* root() {
    const tsk = yield* spawn(function* () {
      yield* take("do not miss");
      actual.push("didn't get missed");
    });

    // sleep to progress the spawned task
    yield* sleep(0);

    yield* spawn(function* firstspawn() {
      yield* put({ type: "c" });
      yield* put({ type: "do not miss" });
    });

    yield* take("c");

    yield* tsk;
  }

  const store = createStore({ schemas: [createSchema()] });
  await store.run(root);
  const expected = ["didn't get missed"];
  expect(actual).toEqual(expected);
});
