---
title: Supervisors
description: Learn how supervisor tasks work
---

A supervisor task is a way to monitor children tasks and manage their health. By
structuring your side-effects and business logic around supervisor tasks, we
gain interesting coding paradigms that result in easier to read and manage code.

[Supplemental reading from erlang](https://www.erlang.org/doc/design_principles/des_princ)

The most basic version of a supervisor is simply an infinite loop that calls a
child task:

```ts
import { call, sleep } from "effection";

function* supervisor() {
  while (true) {
    try {
      yield* call(someTask);
    } catch (err) {
      console.error(err);
    }
  }
}

function* someTask() {
  yield* sleep(10 * 1000);
  throw new Error("boom!");
}
```

Here we `call` some task that should always be in a running and healthy state.
If it raises an exception, we log it and try to run the task again.

Building on top of that simple supervisor, we can have tasks that always listen
for events and if they fail, restart them.

```ts
import { parallel, take } from "starfx";
import { run } from "effection";

function* watchFetch() {
  while (true) {
    const action = yield* take("FETCH_USERS");
    console.log(action);
  }
}

function* send() {
  yield* put({ type: "FETCH_USERS" });
  yield* put({ type: "FETCH_USERS" });
  yield* put({ type: "FETCH_USERS" });
}

await run(parallel([watchFetch, send]));
```

Here we create a supervisor function using a helper `take` to call a function
for every `FETCH_USERS` event emitted.

While inside a `while` loop, you get full access to its powerful flow control.
Another example, let's say we we only want to respond to a login action when the
user isn't logged in and conversely only listen to a logout action when the user
is logged in:

```ts
function*() {
  while (true) {
    const login = yield* take("LOGIN");
    // e.g. fetch token with creds inside `login.payload`
    const logout = yield* take("LOGOUT");
    // e.g. destroy token from `logout.payload`
  }
}
```

Interesting, we've essentially created a finite state machine within a
while-loop!

We also built a helper that will abstract the while loop if you don't need it:

```ts
import { takeEvery } from "starfx";

function* watchFetch() {
  yield* takeEvery("FETCH_USERS", function* (action) {
    console.log(action);
  });
}
```

However, this means that we are going to make the same request 3 times, we
probably want a throttle or debounce so we only make a fetch request once within
some interval.

```ts
import { takeLeading } from "starfx";

function* watchFetch() {
  yield* takeLeading("FETCH_USERS", function* (action) {
    console.log(action);
  });
}
```

That's better, now only one task can be alive at one time.

Both thunks and endpoints simply listen for
[actions](/thunks#anatomy-of-an-action) being emitted onto a channel -- which is
just an event emitter -- and then call the middleware stack with that action.

Both thunks and endpoints support overriding the default `takeEvery` supervisor
for either our officially supported supervisors `takeLatest` and `takeLeading`,
or a user-defined supervisor.

Because every thunk and endpoint have their own supervisor tasks monitoring the
health of their children, we allow the end-developer to change the default
supervisor -- which is `takeEvery`:

```ts
const someAction = thunks.create("some-action", { supervisor: takeLatest });
dispatch(someAction()); // this task gets cancelled
dispatch(someAction()); // this task gets cancelled
dispatch(someAction()); // this tasks lives
```

This is the power of supervisors and is fundamental to how `starfx` works.

# poll

When activated, call a thunk or endpoint once every N millisecond indefinitely
until cancelled.

```ts
import { poll } from "starfx";

const fetchUsers = api.get("/users", { supervisor: poll() });
store.dispatch(fetchUsers());
// fetch users
// sleep 5000
// fetch users
// sleep 5000
// fetch users
store.dispatch(fetchUsers());
// cancelled
```

The default value provided to `poll()` is **5 seconds**.

You can optionally provide a cancel action instead of calling the thunk twice:

```ts
import { poll } from "starfx";

const cancelPoll = createAction("cancel-poll");
const fetchUsers = api.get("/users", {
  supervisor: poll(5 * 1000, `${cancelPoll}`),
});
store.dispatch(fetchUsers());
// fetch users
// sleep 5000
// fetch users
// sleep 5000
// fetch users
store.dispatch(cancelPoll());
// cancelled
```

# timer

Only call a thunk or endpoint at-most once every N milliseconds.

```ts
import { timer } from "starfx";

const fetchUsers = api.get("/users", { supervisor: timer(1000) });
store.dispatch(fetchUsers());
store.dispatch(fetchUsers());
// sleep(100);
store.dispatch(fetchUsers());
// sleep(1000);
store.dispatch(fetchUsers());
// called: 2 times
```

The default value provided to `timer()` is **5 minutes**. This means you can
only call `fetchUsers` at-most once every **5 minutes**.

## clearTimers

Want to clear a timer and refetch?

```ts
import { clearTimers, timer } from "starfx";

const fetchUsers = api.get("/users", { supervisor: timer(1000) });
store.dispatch(fetchUsers());
store.dispatch(clearTimers(fetchUsers()));
store.dispatch(fetchUsers());
// called: 2 times
store.dispatch(clearTimers("*")); // clear all timers
```
