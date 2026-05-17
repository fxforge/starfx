import React from "react";
import ReactDOM from "react-dom/client";
import { Provider } from "starfx/react";
import { createStore, take } from "starfx";
import { thunks, schema } from "./thunks.js";
import App from "./App.js";
import "./index.css";

init();

function init() {
  const store = createStore({
    schema,
    tasks: [logger, thunks.register],
  });
  // makes `fx` available in devtools
  (window as any).fx = store;

  ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
    <React.StrictMode>
      <Provider store={store}>
        <App id="1" />
      </Provider>
    </React.StrictMode>
  );
}

function* logger() {
  while (true) {
    const action = yield* take("*");
    console.log("action", action);
  }
}
