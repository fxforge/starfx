---
title: Loaders
slug: loaders
description: What are loaders?
---

Loaders are general purpose "status trackers." They track the status of a thunk,
an endpoint, or a composite of them. One of the big benefits of decoupled
loaders is you can create as many as you want, and control them however you
want.

[Read my blog article about it](https://bower.sh/on-decoupled-loaders)

# Usage

For endpoints, loaders are installed automatically and track fetch requests.
Loader success is determined by `Response.ok` or if `fetch` throws an error.

You can also use loaders manually:

```ts
import { put } from "starfx";
// imaginary schema
import { schema } from "./schema";

function* fn() {
  yield* put(schema.loaders.start({ id: "my-id" }));
  yield* put(schema.loaders.success({ id: "my-id" }));
  yield* put(schema.loaders.error({ id: "my-id", message: "boom!" }));
}
```

For thunks you can use `mdw.loader()` which will track the status of a thunk.

```ts
import { createThunks, mdw } from "starfx";
// imaginary schema
import { schema } from "./schema";

const thunks = createThunks();
thunks.use(mdw.loader(schema));
thunks.use(thunks.routes());

const go = thunks.create("go", function* (ctx, next) {
  throw new Error("boom!");
});

const store = createStore({ schema });
store.dispatch(go());
schema.loaders.selectById(store.getState(), { id: `${go}` });
// status = "error"; message = "boom!"
```

# Shape

```ts
export type IdProp = string | number;
export type LoadingStatus = "loading" | "success" | "error" | "idle";
export interface LoaderItemState<
  M extends Record<string, unknown> = Record<IdProp, unknown>,
> {
  id: string;
  status: LoadingStatus;
  message: string;
  lastRun: number;
  lastSuccess: number;
  meta: M;
}

export interface LoaderState<
  M extends AnyState = AnyState,
> extends LoaderItemState<M> {
  isIdle: boolean;
  isLoading: boolean;
  isError: boolean;
  isSuccess: boolean;
  isInitialLoading: boolean;
}
```

# `isLoading` vs `isInitialLoading`

Why does this distinction exist? Well, when building a web app with `starfx`,
it's very common to have called the same endpoint multiple times. If that loader
has already successfully been called previously, `isInitialLoading` will **not**
flip states.

The primary use case is: why show a loader if we can already show the user data?

Conversely, `isLoading` will always be true when a loader is in "loading" state.

This information is derived from `lastRun` and `lastSuccess`. Those are unix
timestamps of the last "loading" loader and the last time it was in "success"
state, respectively.

# The `meta` property

You can put whatever you want in there. This is a useful field when you want to
pass structured data from a thunk into the view on success or failure. Maybe
this is the new `id` for the entity you just created and the view needs to know
it. The `meta` prop is where you would put contextual information beyond the
`message` string.

Here's an example for how you can update the `meta` property inside an endpoint:

```tsx
const fetchUsers = api.get("/users", function* (ctx, next) {
  yield* next();
  if (!ctx.json.ok) return;
  // this will merge with the default success loader state
  // so you don't have to set the `status` here as it is done automatically
  // with the api middleware
  ctx.loader = { meta: { total: ctx.json.value.length } };
});

function App() {
  const loader = useQuery(fetchUsers());
  if (loader.isInitialLoading) return <div>loading ...</div>;
  if (loader.isError) return <div>error: {loader.message}</div>;
  return <div>Total number of users: {loader.meta.total}</div>;
}
```
