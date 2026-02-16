---
title: Getting Started
description: Use starfx with deno, node, or the browser
toc: 1
---

# Motivation

We think we need a react framework and server-side rendering (SSR) because
that's where money is being made. If we are building a highly dynamic and
interactive web application then we probably don't need SSR. These frameworks
sell us that they are an easier way to build web apps, but that's not strictly
true. Just think of it this way: if we can build a web app using **only** static
assets, isn't that simpler than having static assets **and** a react framework
server?

React hook-based fetching and caching libraries dramatically simplify data
synchronization but are so tightly coupled to a component's life cycle that it
creates waterfall fetches and loading spinners everywhere. We also have the
downside of not being able to normalize our cache which means we have to spend
time thinking about how and when to invalidate our cache.

Further, all of these data caching libraries don't handle data normalization. In
many similar libraries we are going to see a line like: "Data normalization is
hard and it isn't worth it." Their libraries are not built with data
normalization in mind so they claim it's an anti-feature. Why do we want to
normalize data in the backend but not the frontend? Data normalization is
critically important because it makes CRUD operations automatically update our
web app without having to invalidate our cache.

So what if we are building a highly interactive web app that doesn't need SEO
and we also need more control over data synchronization and caching?

Are you frustrated by the following issues in your react app?

- Prop drilling
- Waterfall fetching data
- Loading spinners everywhere
- Extraneous network calls
- Business logic tightly coupled to react component lifecycle hooks
- State management boilerplate
- Lack of state management
- Lack of async flow control tooling

We built `starfx` because we looked at the web app landscape and felt like there
was something missing.

The benefits of using this library:

- The missing model and controller (MC) in react (V)
- Designed for single-page applications (SPAs)
- Makes data normalization easy and straightforward
- Tools to preload and refresh data
- Has a powerful middleware system similar to `express` to handle requests and
  responses
- Reduces state management boilerplate to its absolute essentials
- Has a robust side-effect management system using structured concurrency
- Has data synchronization and caching separated from `react`

# When to use this library?

The primary target for this library are SPAs. This is for an app that might be
hosted inside an object store (like s3) or with a simple web server (like nginx)
that serves files and that's it.

Is your app highly interactive, requiring it to persist data across pages? This
is the sweet spot for `starfx`.

This library is **not** a great fit for ecommerce, tiny projects, or blogs. This
is for web apps that are generally behind a login screen that require a
desktop-class user experience. This library is designed to scale, so it might
feel a little overwhelming. Just know if you use this library, your code will be
easier to read, easier to write, easier to refactor, all while handling a
massive amount of business complexity.

# Code

Here we demonstrate a complete example so you can glimpse at how `starfx` works.
In this example, we will fetch a github repo from an API endpoint, cache the
`Response` json, and then ensure the endpoint only gets called at-most once
every **5 minutes**, mimicking the basic features of `react-query`.

[Codesanbox](https://codesandbox.io/p/sandbox/starfx-simplest-dgqc9v?file=%2Fsrc%2Findex.tsx)

```tsx
import { createApi, createSchema, createStore, mdw, timer } from "starfx";
import { Provider, useCache } from "starfx/react";

const [schema, initialState] = createSchema();
const store = createStore({ initialState });

const api = createApi();
// mdw = middleware
api.use(mdw.api({ schema }));
// where `fetchRepo` will be placed inside the middleware stack
api.use(api.routes());
api.use(mdw.fetch({ baseUrl: "https://api.github.com" }));

const fetchRepo = api.get(
  "/repos/neurosnap/starfx",
  { supervisor: timer() },
  api.cache(),
);

store.run(api.register);

function App() {
  return (
    <Provider schema={schema} store={store}>
      <Example />
    </Provider>
  );
}

function Example() {
  const { isInitialLoading, isError, message, data } = useCache(fetchRepo());
  if (isInitialLoading) return "Loading ...";
  if (isError) return `An error has occurred: ${message}`;

  return (
    <div>
      <h1>{data.name}</h1>
      <p>{data.description}</p>
      <strong>👀 {data.subscribers_count}</strong>{" "}
      <strong>✨ {data.stargazers_count}</strong>{" "}
      <strong>🍴 {data.forks_count}</strong>
    </div>
  );
}
```

# Install

> [!NOTE]
> `starfx` uses `effection` (v4) internally for structured concurrency. You will also find use of it in your thunks. It is required as a peer dependency which allows for more direct upgrading as APIs evolve.

```bash
npm install starfx effection
```

```bash
yarn add starfx effection
```

Or in deno:

```ts
import * as starfx from "https://deno.land/x/starfx@0.16.0/mod.ts";
```

# Effection

This library leverages structured concurrency using
[`effection`](https://frontside.com/effection). It is highly recommended that
you have a brief understanding of how its API because it is used heavily within
`starfx`.
