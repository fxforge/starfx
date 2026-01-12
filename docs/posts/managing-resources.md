---
title: Managing resources
description: How to use .manage() to register effection resources with store/thunks/api
---

# Managed resources ✅

`starfx` supports managing Effection `resource`s and exposing them via a `Context` using the `.manage()` helper on `store`, `thunks` (from `createThunks`) and `api` (from `createApi`). The `manage` call will start the resource inside the scope and return a `Context` you can `get()` or `expect()` inside your operations to access the provided value.

A `resource` is useful in encapsulating logic or functionality. It is particularly useful for managing connections such as a WebSocket connections, Web Workers, auth or telemetry. These processes can be wired up, including failure, restart and shutdown logic, and then used in any of your actions.

Example (contrived) pattern:

```ts
import { resource } from "effection";

function guessAge(): Operation<{ guess: number; cumulative: number | null }> {
  return resource(function* (provide) {
    let cumulative: number | null = 0;
    try {
      yield* provide({
        get guess() {
          const n = Math.floor(Math.random() * 100);
          if (cumulative !== null) cumulative += n;
          return n;
        },
        get cumulative() {
          return cumulative;
        },
      });
    } finally {
      // cleanup when the resource is closed
      cumulative = null;
    }
  });
}
```

Manage the resource:

```ts
// on a `store`:
const store = createStore({ initialState: {} });
const GuesserCtx = store.manage("guesser", guessAge());
// Or with `createThunks` (the pattern is the same for `createApi`):
const thunks = createThunks();
const GuesserCtx = thunks.manage("guesser", guessAge());

// inside an operation (thunk, middleware, etc.)
const action = thunks.create("do-thing", function* (ctx, next) {
  // use the managed resource inside an action
  const g = yield* GuesserCtx.get(); // may return undefined
  const g2 = yield* GuesserCtx.expect(); // will throw if resource is not available

  console.log(g2.guess, g2.cumulative);
  yield* next();
});

store.run(thunks.register);
store.dispatch(action());
```

This API exists both at the overall store "level" and at the thunk "level". Resources managed at the store level are available in all registered thunks/apis whereas a resource managed at a thunk is _only available_ in that thunk. This would, for example, allow you to only enable auth for a single `createAPI()` subset of thunks.
