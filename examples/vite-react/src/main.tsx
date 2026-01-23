import React from "react";
import ReactDOM from "react-dom/client";
import { createStore, take } from "starfx";
import { Provider } from "starfx/react";
import { api, schema } from "./api.ts";
import App from "./App.tsx";
import "./index.css";

init();

function init() {
  const store = createStore({ schemas: [schema] });
  // makes `fx` available in devtools
  (window as any).fx = store;

  store.run([
    function* logger() {
      while (true) {
        const action = yield* take("*");
        console.log("action", action);
      }
    },
    api.register,
  ]);

  ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
    <React.StrictMode>
      <Provider store={store}>
        <App id="1" />
      </Provider>
    </React.StrictMode>
  );
}
