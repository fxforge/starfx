import { api, schema } from "./api";
import { createStore } from "starfx";

export function setupStore({ initialState = {} } = {}) {
  void initialState;
  const store = createStore({
    schema,
    tasks: [api.register],
  });

  return store;
}
