![starfx](./docs/static/logo.svg)

# starfx

A micro-mvc framework for react apps.

If we think in terms of MVC, if `react` is the **View**, then `starfx` is the
**Model** and **Controller**.

[Get started](https://starfx.bower.sh)

Features:

- A powerful middleware system to fetch API data
- An immutable and reactive data store
- A task tree side-effect system for handling complex business logic using
  structured concurrency
- React integration

```tsx
import { createApi, createSchema, createStore, mdw, timer } from "starfx";
import { Provider, useCache } from "starfx/react";

const [schema, initialState] = createSchema();
const store = createStore({ initialState });

const api = createApi();
// mdw = middleware
api.use(mdw.api({ schema }));
api.use(api.routes());
api.use(mdw.fetch({ baseUrl: "https://api.github.com" }));

const fetchRepo = api.get(
  "/repos/neurosnap/starfx",
  { supervisor: timer() },
  api.cache()
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
