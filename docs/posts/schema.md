---
title: Schema
description: Learn more about schamas and slices
toc: 2
---

A schema has two primary features:

- A fully typed state shape
- Reusable pieces of state management logic

A schema must be an object. It is composed of slices of state. Slices can
represent any data type, however, we recommend keeping it as JSON serializable
as possible. Slices not only hold a value, but with it comes some handy
functions to:

- Update the value
- Query for data within the value

Our schema implementation was heavily inspired by [zod](https://zod.dev/).

# Schema assumptions

`createSchema` requires two slices by default in order for it and everything
inside `starfx` to function properly: `cache` and `loaders`.

Why do we require those slices? Because if we can assume those exist, we can
build a lot of useful middleware and supervisors on top of that assumption. It's
a place for `starfx` and third-party functionality to hold their state.

```ts
import { createSchema, slice } from "starfx";

const [schema, initialState] = createSchema({
  cache: slice.table(),
  loaders: slice.loaders(),
});
```

# Built-in slices

As a result, the following slices should cover the most common data types and
associated logic.

## `slice.any`

This is essentially a basic getter and setter slice. You can provide the type it
ought to be and it has a couple functions to manage and query the value stored
inside of it.

```ts
const [schema] = createSchema({
  nav: slice.any<bool>(false),
});

function*() {
  yield* schema.update(schema.nav.set(true)); // set the value
  const nav = yield* select(schema.nav.select); // grab the value
  yield* schema.update(schema.nav.reset()); // reset value back to inititial
}
```

## `num`

This slice has some custom actions to manage a number value.

```ts
const [schema] = createSchema({
  views: slice.num(0),
});

function*() {
  yield* schema.update(schema.views.increment());
  yield* schema.update(schema.views.decrement());
  yield* schema.update(schema.views.set(100));
  const views = yield* select(schema.views.select);
  yield* schema.update(schema.views.reset()); // reset value back to inititial
}
```

## `str`

This slice is probably not super useful since it is essentially the same as
`slice.any<string>` but we could add more actions to it in the future.

```ts
const [schema] = createSchema({
  token: slice.str(""),
});

function*() {
  yield* schema.update(schema.token.set("1234"));
  const token = yield* select(schema.token.select);
  yield* schema.update(schema.token.reset()); // reset value back to inititial
}
```

## `obj`

This is a specialized slice with some custom actions to deal with javascript
objects.

```ts
const [schema] = createSchema({
  settings: slice.obj({
    notifications: false,
    theme: "light",
  }),
});

function*() {
  yield* schema.update(schema.settings.update(theme, "dark"));
  yield* schema.update(schema.settings.update(notifications, true));
  const settings = yield* select(schema.settings.select);
  yield* schema.update(schema.token.reset()); // reset value back to inititial
  yield* schema.update(
    schema.token.set({ notifications: true, theme: "dark" }),
  );
}
```

## `table`

This is the more powerful and specialized slice we created. It attempts to
mimick a database table where it holds an object:

```ts
type Table<Entity = any> = Record<string | number, Entity>;
```

The key is the entity's primary id and the value is the entity itself.

```ts
const [schema] = createSchema({
  users: slice.table({ empty: { id: "", name: "" } }),
});

function*() {
  const user1 = { id: "1", name: "bbob" };
  const user2 = { id: "2", name: "tony" };
  const user3 = { id: "3", name: "jessica" };
  yield* schema.update(
    schema.users.add({
      [user1.id]: user1,
      [user2.id]: user2,
      [user3.id]: user3,
    }),
  );
  yield* schema.update(
    schema.users.patch({ [user1.id]: { name: "bob" } }),
  );
  yield* schema.update(
    schema.users.remove([user3.id]),
  );
  
  // selectors
  yield* select(schema.users.selectTable());
  yield* select(schema.users.selectTableAsList());
  yield* select(schema.users.selectById({ id: user1.id }));
  yield* select(schema.users.selectByIds({ ids: [user1.id, user2.id] }));

  yield* schema.update(schema.users.reset());
}
```

### empty

When `empty` is provided to `slice.table` and we use a selector like
`selectById` to find an entity that does **not** exist, we will return the
`empty` value.

This mimicks golang's empty values but catered towards entities. When `empty` is
provided, we guarentee that `selectById` will return the correct state shape,
with all the empty values that the end-developer provides.

By providing a "default" entity when none exists, it promotes safer code because
it creates stable assumptions about the data we have when performing lookups.
The last thing we want to do is litter our view layer with optional chaining,
because it sets up poor assumptions about the data we have.

Read more about this design philosophy in my blog post:
[Death by a thousand existential checks](https://bower.sh/death-by-thousand-existential-checks).

When creating table slices, we highly recommend providing an `empty` value.

Further, we also recommend creating entity factories for each entity that exists
in your system.

[Read more about entity factories.](https://bower.sh/entity-factories)

## `loaders`

This is a specialized database table specific to managing loaders in `starfx`.
[Read more about loaders here](/loaders).

```ts
const [schema] = createSchema({
  loaders: slice.loaders(),
});

function*() {
  yield* schema.update(schema.loaders.start({ id: "my-id" }));
  yield* schema.update(schema.loaders.success({ id: "my-id" }));
  const loader = yield* select(schema.loaders.selectById({ id: "my-id" }));
  console.log(loader);
}
```

# Build your own slice

We will build a `counter` slice to demonstrate how to build your own slices.

```ts
import type { AnyState } from "starfx";
import { BaseSchema, select } from "starfx/store";

export interface CounterOutput<S extends AnyState> extends BaseSchema<number> {
  schema: "counter";
  initialState: number;
  increment: (by?: number) => (s: S) => void;
  decrement: (by?: number) => (s: S) => void;
  reset: () => (s: S) => void;
  select: (s: S) => number;
}

export function createCounter<S extends AnyState = AnyState>(
  { name, initialState = 0 }: { name: keyof S; initialState?: number },
): CounterOutput<S> {
  return {
    name: name as string,
    schema: "counter",
    initialState,
    increment: (by = 1) => (state) => {
      (state as any)[name] += by;
    },
    decrement: (by = 1) => (state) => {
      (state as any)[name] -= by;
    },
    reset: () => (state) => {
      (state as any)[name] = initialState;
    },
    select: (state) => {
      return (state as any)[name];
    },
  };
}

export function counter(initialState?: number) {
  return (name: string) => createCounter<AnyState>({ name, initialState });
}

const [schema, initialState] = createSchema({
  counter: counter(100),
});
const store = createStore(initialState);

store.initialize(function* () {
  yield* schema.update([
    schema.counter.increment(),
    schema.counter.increment(),
  ]);
  const result = yield* select(schema.counter.select);
  console.log(result); // 102
});
```
