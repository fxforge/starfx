import { Err, Ok, type Result, compose, run, safe, sleep } from "../index.js";
import { expect, test } from "../test.js";

test("should compose middleware", async () => {
  const mdw = compose<{ one: string; three: string; result: Result<void> }>([
    function* (ctx, next) {
      ctx.one = "two";
      yield* next();
    },
    function* (ctx, next) {
      ctx.three = "four";
      yield* next();
    },
  ]);
  const actual = await run(function* () {
    const ctx = { one: "", three: "", result: Ok(void 0) };
    yield* mdw(ctx);
    return ctx;
  });

  const expected = {
    // we should see the mutation
    one: "two",
    three: "four",
    result: Ok(void 0),
  };
  expect(actual).toEqual(expected);
});

test("order of execution", async () => {
  const mdw = compose<{ actual: string; result: Result<void> }>([
    function* (ctx, next) {
      ctx.actual += "a";
      yield* next();
      ctx.actual += "g";
    },
    function* (ctx, next) {
      ctx.actual += "b";
      yield* next();
      ctx.actual += "f";
    },
    function* (ctx, next) {
      ctx.actual += "c";
      yield* next();
      ctx.actual += "d";
      ctx.actual += "e";
    },
  ]);

  const actual = await run(function* () {
    const ctx = { actual: "", result: Ok(void 0) };
    yield* mdw(ctx);
    return ctx;
  });
  const expected = {
    actual: "abcdefg",
    result: Ok(void 0),
  };
  expect(actual).toEqual(expected);
});

test("when error is discovered, it should throw", async () => {
  const err = new Error("boom");
  const mdw = compose([
    function* (_, next) {
      yield* next();
      expect.fail();
    },
    function* (_, next) {
      yield* next();
      throw err;
    },
  ]);
  const actual = await run(function* () {
    const ctx = {};
    const result = yield* safe(() => mdw(ctx));
    return result;
  });

  const expected = Err(err);
  expect(actual).toEqual(expected);
});
