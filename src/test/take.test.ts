import type { AnyAction } from "../index.js";
import { put, sleep, spawn, take } from "../index.js";
import { createSchema, createStore } from "../store/index.js";
import { expect, test } from "../test.js";

test("a put should complete before more `take` are added and then consumed automatically", async () => {
  const actual: AnyAction[] = [];

  function* channelFn() {
    // TODO why is this needed?
    yield* sleep(0);
    yield* put({ type: "action-1", payload: 1 });
    yield* put({ type: "action-1", payload: 2 });
  }

  function* root() {
    yield* spawn(channelFn);
    // sleep to progress the spawned task
    yield* sleep(0);

    actual.push(yield* take("action-1"));
    actual.push(yield* take("action-1"));
  }

  const store = createStore({ schemas: [createSchema()] });
  await store.run(root);

  expect(actual).toEqual([
    { type: "action-1", payload: 1 },
    { type: "action-1", payload: 2 },
  ]);
});

test("take from default channel", async () => {
  expect.assertions(1);
  // TODO do should we really need all of these sleeps?
  function* channelFn() {
    yield* put({ type: "action-*" });
    yield* sleep(0);
    yield* put({ type: "action-1" });
    yield* sleep(0);
    yield* put({ type: "action-2" });
    yield* sleep(0);
    yield* put({ type: "unnoticeable-action" });
    yield* sleep(0);
    yield* put({
      type: "",
      payload: {
        isAction: true,
      },
    });
    yield* sleep(0);
    yield* put({
      type: "",
      payload: {
        isMixedWithPredicate: true,
      },
    });
    yield* sleep(0);
    yield* put({
      type: "action-3",
    });
  }

  const actual: AnyAction[] = [];
  function* genFn() {
    const takes = yield* spawn(function* () {
      try {
        actual.push(yield* take("*")); // take all actions
        actual.push(yield* take("action-1")); // take only actions of type 'action-1'
        actual.push(yield* take(["action-2", "action-2222"])); // take either type
        actual.push(yield* take((a: AnyAction) => a.payload?.isAction)); // take if match predicate
        actual.push(
          yield* take([
            "action-3",
            (a: AnyAction) => a.payload?.isMixedWithPredicate,
          ]),
        ); // take if match any from the mixed array
        actual.push(
          yield* take([
            "action-3",
            (a: AnyAction) => a.payload?.isMixedWithPredicate,
          ]),
        ); // take if match any from the mixed array
      } catch (e) {
        console.error("Error in take:", e);
      } finally {
        actual.push({ type: "auto ended" });
      }
    });
    // sleep to progress the spawned task
    yield* sleep(0);
    yield* spawn(channelFn);
    yield* takes; // wait for the takes to complete
  }

  const store = createStore({ schemas: [createSchema()] });
  await store.run(genFn);

  const expected = [
    {
      type: "action-*",
    },
    {
      type: "action-1",
    },
    {
      type: "action-2",
    },
    {
      type: "",
      payload: {
        isAction: true,
      },
    },
    {
      type: "",
      payload: {
        isMixedWithPredicate: true,
      },
    },
    {
      type: "action-3",
    },
    { type: "auto ended" },
  ];
  expect(actual).toEqual(expected);
});
