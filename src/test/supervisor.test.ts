import { take } from "../action.js";
import { API_ACTION_PREFIX } from "../action.js";
import {
  type Operation,
  call,
  run,
  sleep,
  spawn,
  supervise,
  superviseBackoff,
} from "../index.js";
import { describe, expect, test } from "../test.js";
import type { ActionWithPayload } from "../types.js";

describe("superviseBackoff", () => {
  test("should increase number exponentially", () => {
    const actual: number[] = [];
    for (let i = 1; i < 15; i += 1) {
      actual.push(superviseBackoff(i));
    }
    expect(actual).toEqual([
      20, 40, 80, 160, 320, 640, 1280, 2560, 5120, 10240, -1, -1, -1, -1,
    ]);
  });
});

type LogAction = ActionWithPayload<{ message: string }>;

test("should recover with backoff pressure", async () => {
  const err = console.error;
  console.error = () => {};

  const actions: LogAction[] = [];
  const backoff = (attempt: number) => {
    if (attempt === 4) return -1;
    return attempt;
  };

  await run(function* () {
    function* op(): Operation<void> {
      throw new Error("boom!");
    }
    yield* spawn(function* () {
      while (true) {
        const action = yield* take<LogAction["payload"]>("*");
        actions.push(action);
      }
    });
    // sleep to progress the spawned task
    yield* sleep(0);
    yield* call(supervise(op, backoff));
  });

  expect(actions.length).toEqual(3);
  expect(actions[0].type).toEqual(`${API_ACTION_PREFIX}supervise`);
  expect(actions[0].meta).toEqual({
    message: "Exception caught, waiting 1ms before restarting operation",
  });
  expect(actions[1].type).toEqual(`${API_ACTION_PREFIX}supervise`);
  expect(actions[1].meta).toEqual({
    message: "Exception caught, waiting 2ms before restarting operation",
  });
  expect(actions[2].type).toEqual(`${API_ACTION_PREFIX}supervise`);
  expect(actions[2].meta).toEqual({
    message: "Exception caught, waiting 3ms before restarting operation",
  });

  console.error = err;
});
