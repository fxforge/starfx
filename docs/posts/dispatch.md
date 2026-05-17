---
title: Dispatch
description: How to activate controllers
---

We use the term `dispatch` when we are emitting an event with a specific type
signature
([flux standard action](https://github.com/redux-utilities/flux-standard-action)).

There are two ways to activate a thunk: by dispatching an action or calling it
within another thunk.

The type signature of `dispatch`:

```ts
type Dispatch = (a: Action | Action[]) => any;
```

```ts
const { createSchema, createStore } from "starfx";
const schema = createSchema();
const store = createStore({ schema });

store.dispatch({ type: "action", payload: {} });
```

# Dispatch in thunk

```ts
import { put } from "starfx";

function* thunk(ctx, next) {
  yield* put({ type: "click" });
  yield* next();
}
```

# Dispatch in react

You can also use dispatch with a `react` hook:

```tsx
import { useDispatch } from "starfx/react";

function App() {
  const dispatch = useDispatch();

  return <button onClick={() => dispatch({ type: "click" })}>Click me!</button>;
}
```

# Listening to actions

This is a pubsub system after all. How can we listen to action events?

```ts
import { take } from "starfx";

function* watch() {
  while (true) {
    const action = yield* take("click");
    // -or- const action = yield* take("*");
    // -or- const action = yield* take((act) => act.type === "click");
    // -or- const action = yield* take(["click", "me"]);
    console.log(action.payload);
  }
}

store.run(watch);
```

`watch` is what we call a [supervisor](/supervisors). Click that link to learn
more about how they provide powerful flow control mechanisms.
