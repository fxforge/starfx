import ReactDOM from "react-dom/client";
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
  api.cache(),
);

store.initialize(api.register);

function App() {
  return (
    <Provider schema={schema} store={store}>
      <Example />
    </Provider>
  );
}

function Example() {
  const { isLoading, isError, message, data } = useCache(fetchRepo());

  if (isLoading || !data) return "Loading ...";

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

const root = document.getElementById("root") as HTMLElement;
ReactDOM.createRoot(root).render(
  <Provider schema={schema} store={store}>
    <App />
  </Provider>,
);
