import ReactDOM from "react-dom/client";
import {
  createApi,
  createSchema,
  createStore,
  mdw,
  slice,
  timer,
} from "starfx";
import { Provider, useCache } from "starfx/react";

const api = createApi();
const schema = createSchema({
  cache: slice.table(),
  loaders: slice.loaders(),
});
const store = createStore({ schema, tasks: [api.register] });

// mdw = middleware
api.use(mdw.api({ schema }));
api.use(api.routes());
api.use(mdw.fetch({ baseUrl: "https://api.github.com" }));

const fetchRepo = api.get(
  "/repos/neurosnap/starfx",
  { supervisor: timer() },
  api.cache()
);

function App() {
  return <Example />;
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
  <Provider store={store}>
    <App />
  </Provider>
);
