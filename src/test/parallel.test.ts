import type { Operation, Result } from "../index.js";
import { Err, Ok, each, parallel, run, sleep, spawn, until } from "../index.js";
import { expect, test } from "../test.js";

interface Defer<T> {
  promise: Promise<T>;
  resolve: (t: T) => void;
  reject: (t: Error) => void;
}

function defer<T>(): Defer<T> {
  let resolve: (t: T) => void = () => {};
  let reject: (t: Error) => void = () => {};
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return { resolve, reject, promise };
}

test("should return an immediate channel with results as they are completed", async () => {
  const result = await run(function* () {
    const results = yield* parallel([
      function* () {
        // force a delay to ensure order
        yield* sleep(20);
        return "second";
      },
      function* () {
        return "first";
      },
    ]);

    const res: Result<string>[] = [];
    for (const val of yield* each(results.immediate)) {
      res.push(val);
      yield* each.next();
    }

    yield* results;
    return res;
  });

  expect(result).toEqual([Ok("first"), Ok("second")]);
});

test("should return a sequence channel with results preserving array order as results", async () => {
  const result = await run(function* () {
    const results = yield* parallel([
      function* () {
        return "second";
      },
      function* () {
        return "first";
      },
    ]);

    const res: Result<string>[] = [];
    for (const val of yield* each(results.sequence)) {
      res.push(val);
      yield* each.next();
    }

    yield* results;
    return res;
  });

  expect(result).toEqual([Ok("second"), Ok("first")]);
});

test("should return all the result in an array, preserving order", async () => {
  const result = await run(function* () {
    const para = yield* parallel([
      function* () {
        return "second";
      },
      function* () {
        return "first";
      },
    ]);

    return yield* para;
  });

  expect(result).toEqual([Ok("second"), Ok("first")]);
});

test("should return empty array", async () => {
  let actual;
  await run(function* (): Operation<void> {
    const results = yield* parallel([]);
    actual = yield* results;
  });
  expect(actual).toEqual([]);
});

test("should resolve all async items", async () => {
  const two = defer();

  function* one() {
    return 1;
  }

  const result = await run(function* () {
    yield* spawn(function* () {
      two.resolve(2);
    });
    const results = yield* parallel([one, () => until(two.promise)]);
    return yield* results;
  });

  expect(result).toEqual([Ok(1), Ok(2)]);
});

test("should stop all operations when there is an error", async () => {
  let actual: Result<number>[] = [];
  const one = defer<number>();
  const two = defer<number>();

  function* genFn() {
    try {
      const results = yield* parallel([
        () => until(one.promise),
        () => until(two.promise),
      ]);
      actual = yield* results;
    } catch (_) {
      actual = [Err(new Error("should not get hit"))];
    }
  }

  const err = new Error("error");
  one.reject(err);
  two.resolve(1);

  await run(genFn);

  const expected = [Err(err), Ok(1)];
  expect(actual).toEqual(expected);
});
