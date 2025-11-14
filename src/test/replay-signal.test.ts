import { createReplaySignal } from "../fx/replay-signal.js";
import { each, run, sleep, spawn } from "../index.js";
import { expect, test } from "../test.js";

test("should call the generator function", async () => {
  const thunk = createReplaySignal();
  const checkOne = [] as string[];
  const checkTwo = [] as string[];
  const checkThree = [] as string[];

  function* valPush(arrKey: string, arr: string[]) {
    for (const val of yield* each(thunk)) {
      console.log(arrKey, "received", val);
      arr.push(val as string);
      yield* each.next();
    }
  }

  await run(function* () {
    console.log("spawning consumers");
    const v1 = yield* spawn(() => valPush("checkOne", checkOne));
    yield* sleep(0); // allow spawns to start
    thunk.send("first");
    const v2 = yield* spawn(() => valPush("checkTwo", checkTwo));
    yield* sleep(0); // allow spawns to start
    thunk.send("second");
    const v3 = yield* spawn(() => valPush("checkThree", checkThree));
    yield* sleep(0); // allow spawns to start
    thunk.send("third");
    yield* sleep(0); // allow spawns to start
    console.log("sending values");
    thunk.close();
    yield* v1;
    yield* v2;
    yield* v3;
  });

  expect(checkOne).toHaveLength(3);
  expect(checkTwo).toHaveLength(3);
  expect(checkThree).toHaveLength(3);
});
