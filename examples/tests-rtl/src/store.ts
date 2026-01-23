import { api, schema } from "./api";
import { createStore } from "starfx";

export function setupStore({ initialState = {} } = {}) {
  const store = createStore({
    schemas: [schema],
  });

  store.run(api.register);

  return store;
}
