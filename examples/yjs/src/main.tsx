import React from "react";
import ReactDOM from "react-dom/client";
import { Provider } from "starfx/react";
import { createStore, take } from "starfx";
import { defaultStoreUpdater } from "./store/updater.js";
import { thunks, initialState, schema } from "./thunks.js";
import App from "./App.js";
import "./index.css";

init();

function init() {
  const store = createStore({
    initialState,
    setStoreUpdater: defaultStoreUpdater,
  });
  // makes `fx` available in devtools
  (window as any).fx = store;

  store.initialize([
    function* logger() {
      while (true) {
        const action = yield* take("*");
        console.log("action", action);
      }
    },
    thunks.register,
  ]);

  ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
    <React.StrictMode>
      <Provider schema={schema} store={store}>
        <App id="1" />
      </Provider>
    </React.StrictMode>
  );
}
