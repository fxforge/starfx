import React from "react";
import ReactDOM from "react-dom/client";
import { createStore, take, parallel } from "starfx";
import { Provider } from "starfx/react";
import { api, initialState, schema } from "./api.js";
import { App } from "./app.jsx";

init();

function init() {
  const store = createStore({ initialState });
  window.fx = store;

  store.initialize(() =>
    parallel([
      function* logger() {
        while (true) {
          const action = yield* take("*");
          console.log("action", action);
        }
      },
      api.register,
    ]),
  );

  ReactDOM.createRoot(document.getElementById("root")).render(
    <React.StrictMode>
      <Provider schema={schema} store={store}>
        <App id="1" />
      </Provider>
    </React.StrictMode>,
  );
}
