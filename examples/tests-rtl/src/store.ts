import { api, initialState as schemaInitialState } from "./api";
import { createStore } from "starfx";

export function setupStore({ initialState = {} }) {
  const store = createStore({
    initialState: {
      ...schemaInitialState,
      ...initialState,
    },
  });

  store.initialize(api.register);

  return store;
}
