---
title: Error handling
description: How to manage errors
---

By leveraging `effection` and [structured concurrency](/structured-concurrency)
we can let it do most of the heavy lifting for managing errors.

> Read [error handling](https://frontside.com/effection/docs/errors) doc at
> `effection`!

There are some tools `starfx` provides to make it a little easier.

By default in `effection`, if a child task raises an exception, it will bubble
up the ancestry and eventually try to kill the root task. Within `starfx`, we
prevent that from happening with [supervisor](/supervisors) tasks. Having said
that, child tasks can also control how children tasks are managed. Sometimes you
want to kill the child task tree, sometimes you want to recover and restart, and
sometimes you want to bubble the error up the task ancestry.

If you want to capture a task and prevent it from bubbling an exception up, then
you have two `fx`: `scoped` and `safe`.

```ts
import { scoped, until, run, safe } from "starfx";

function* main() {
  try {
    // use `call` to enable JS try/catch
    yield* scoped(() => until(fetch("api.com")));
  } catch (err) {
    console.error(err);
  }

  // -or- if you don't want to use try/catch
  const result = yield* safe(() => until(fetch("api.com")));
  if (!result.ok) {
    console.error(result.err);
  }
}

await run(main);
```

Both functions will catch the child task and prevent it from bubbling up the
error.
