import { parallel } from "../index.js";
import {
  createBatchMdw,
  createSchema,
  createStore,
  slice,
} from "../store/index.js";
import { expect, test } from "../test.js";

test("should batch notify subscribers based on mdw", async () => {
  const schema = createSchema(
    {
      cache: slice.table({ empty: {} }),
      loaders: slice.loaders(),
    },
    {
      middleware: [createBatchMdw(queueMicrotask)],
    },
  );
  const store = createStore({
    schemas: [schema],
  });
  let counter = 0;
  store.subscribe(() => {
    counter += 1;
  });
  await store.run(function* () {
    const group: any = yield* parallel([
      () => schema.update(schema.cache.add({ "1": "one" })),
      () => schema.update(schema.cache.add({ "2": "two" })),
      () => schema.update(schema.cache.add({ "3": "three" })),
      () => schema.update(schema.cache.add({ "4": "four" })),
      () => schema.update(schema.cache.add({ "5": "five" })),
      () => schema.update(schema.cache.add({ "6": "six" })),
    ]);
    yield* group;
    // make sure it will still notify subscribers after batched round
    yield* schema.update(schema.cache.add({ "7": "seven" }));
  });
  expect(counter).toBe(2);
});
