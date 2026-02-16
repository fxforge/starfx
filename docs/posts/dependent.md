---
title: Dependent Queries
slug: dependent-queries
description: How to call other thunks and endpoints within one
---

In this context, thunks and endpoints are identical, so I will just talk about
thunks throughout this guide.

There are two ways to call a thunk within another thunk.

# Dispatch the thunk as an action

Features:

- Non-blocking
- Thunk is still controlled by supervisor
- Works identical to `dispatch(action)`

```ts
import { put } from "starfx";
const fetchMailboxes = api.get("/mailboxes");
const fetchMail = thunks.create("fetch-mail", function* (ctx, next) {
  yield* put(fetchMailboxes());
});
```

This is the equivalent of using `useDispatch` in your view. As a result, it is
also controlled by the thunk's supervisor task. If that thunk has a supervisor
that might drop the middleware stack from activating (e.g. `takeLeading` or
`timer`) then it might not actually get called. Further, this operation
completes immediately, it does **not** wait for the thunk to complete before
moving to the next yield point.

If you want to make a blocking call to the thunk and wait for it to complete
then you want to call the thunk's middleware stack directly.

# Call the middleware stack directly

Features:

- Blocking
- Middleware stack guarenteed to run
- Does **not** go through supervisor task

What do we mean by "middleware stack"? That is the stack of functions that you
define for a thunk. It does **not** include the supervisor task that manages the
thunk. Because a supervisor task could drop, pause, or delay the execution of a
thunk, we need a way to escape hatch out of it and just call the middleware
stack directly.

```ts
import { parallel, put } from "starfx";
// imaginary schema
import { schema } from "./schema";

const fetchMailboxes = api.get("/mailboxes");
const fetchMessages = api.get<{ id: string }>("/mailboxes/:id/messages");
const fetchMail = thunks.create("fetch-mail", function* (ctx, next) {
  const boxesCtx = yield* fetchMailboxes.run();
  if (!boxesCtx.json.ok) {
    return;
  }

  const boxes = yield* select(schema.mailboxes.selectTableAsList);
  const group = yield* parallel(
    boxes.map((box) => {
      return fetchMessages.run({ id: box.id });
    }),
  );
  const messages = yield* select(schema.messages.selectTableAsList);
  console.log(messages);
});
```
