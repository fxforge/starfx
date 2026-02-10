---
title: Thunks
description: Thunks are tasks for business logic
---

Thunks are the foundational central processing units. They have access to all
the actions being dispatched from the view as well as your global state. They
also wield the full power of structured concurrency.

> Endpoints are specialized thunks as you will see later in the docs

Think of thunks as micro-controllers. Only thunks and endpoints have the ability
to update state (or a model in MVC terms). However, thunks are not tied to any
particular view and in that way are more composable. Thunks can call other
thunks and you have the async flow control tools from `effection` to facilitate
coordination and cleanup.

Every thunk that's created requires a unique id -- user provided string. This
provides us with some benefits:

- User hand-labels each thunk
- Better traceability
- Easier to debug async and side-effects
- Build abstractions off naming conventions (e.g. creating routers
  `/users [GET]`)

They also come with built-in support for a middleware stack (like `express` or
`koa`). This provides a familiar and powerful abstraction for async flow control
for all thunks and endpoints.

Each run of a thunk gets its own `ctx` object which provides a substrate to
communicate between middleware.

```ts
import { until, createThunks, mdw } from "starfx";

const thunks = createThunks();
// catch errors from task and logs them with extra info
thunks.use(mdw.err);
// where all the thunks get called in the middleware stack
thunks.use(thunks.routes());
thunks.use(function* (ctx, next) {
  console.log("last mdw in the stack");
  yield* next();
});

// create a thunk
const log = thunks.create<string>("log", function* (ctx, next) {
  const resp = yield* until(
    fetch("https://log-drain.com", {
      method: "POST",
      body: JSON.stringify({ message: ctx.payload }),
    }),
  );
  console.log("before calling next middleware");
  yield* next();
  console.log("after all remaining middleware have run");
});

store.dispatch(log("sending log message"));
// output:
// before calling next middleware
// last mdw in the stack
// after all remaining middleware have run
```

# Anatomy of thunk middleware

Thunks are a composition of middleware functions in a stack. Therefore, every
single middleware function shares the exact same type signature:

```ts
// for demonstration purposes we are copy/pasting these types which can
// normally be imported from:
//   import type { ThunkCtx, Next } from "starfx";
type Next = () => Operation<void>;

interface ThunkCtx<P = any> extends Payload<P> {
  name: string;
  key: string;
  action: ActionWithPayload<CreateActionPayload<P>>;
  actionFn: IfAny<
    P,
    CreateAction<ThunkCtx>,
    CreateActionWithPayload<ThunkCtx<P>, P>
  >;
  result: Result<void>;
}

function* myMiddleware(ctx: ThunkCtx, next: Next) {
  yield* next();
}
```

Similar to `express` or `koa`, if you do **not** call `next()` then the
middleware stack will stop after the code execution leaves the scope of the
current middleware. This provides the end-user with "exit early" functionality
for even more control.

# Anatomy of an Action

When creating a thunk, the return value is just an action creator:

```ts
console.log(log("sending log message"));
{
  type: "log",
  payload: "sending log message"
}
```

An action is the "event" being emitted from `startfx` and subscribes to a very
particular type signature.

A thunk action adheres to the
[flux standard action spec](https://github.com/redux-utilities/flux-standard-action).

> While not strictly necessary, it is highly recommended to keep actions JSON
> serializable

For thunks we have a more strict payload type signature with additional
properties:

```ts
interface CreateActionPayload<P = any, ApiSuccess = any> {
  name: string; // the user-defined name
  options: P; // thunk payload described below
  key: string; // hash of entire thunk payload
}

interface ThunkAction<P> {
  type: string;
  payload: CreateActionPayload<P>;
}
```

This is the type signature for every action created automatically by
`createThunks` or `createApi`.

# Thunk payload

When calling a thunk, the user can provide a payload that is strictly enforced
and accessible via the `ctx.payload` property:

```ts
const makeItSo = api.get<{ id: string }>("make-it-so", function* (ctx, next) {
  console.log(ctx.payload);
  yield* next();
});

makeItSo(); // type error!
makeItSo("123"); // type error!
makeItSo({ id: "123" }); // nice!
```

If you do not provide a type for an endpoint, then the action can be dispatched
without a payload:

```ts
const makeItSo = api.get("make-it-so", function* (ctx, next) {
  console.log(ctx.payload);
  yield* next();
});

makeItSo(); // nice!
```

# Custom `ctx`

End-users are able to provide a custom `ctx` object to their thunks. It must
extend `ThunkCtx` in order for it to pass, but otherwise you are free to add
whatever properties you want:

```ts
import { createThunks, type ThunkCtx } from "starfx";

interface MyCtx extends ThunkCtx {
  wow: bool;
}

const thunks = createThunks<MyCtx>();

// we recommend a mdw that ensures the property exists since we cannot
// make that guarentee
thunks.use(function* (ctx, next) {
  if (!Object.hasOwn(ctx, "wow")) {
    ctx.wow = false;
  }
  yield* next();
});

const log = thunks.create("log", function* (ctx, next) {
  ctx.wow = true;
  yield* next();
});
```
