import { createThunks, mdw, StoreContext } from "starfx";
import { createSchema } from "./store/schema.js";

export const [schema, initialState] = createSchema();
export type AppState = typeof initialState;

export const thunks = createThunks();
// catch errors from task and logs them with extra info
thunks.use(mdw.err);
// where all the thunks get called in the middleware stack
thunks.use(thunks.routes());
thunks.use(function* (ctx, next) {
  console.log("last mdw in the stack");
  yield* next();
});

export const createFolder = thunks.create<any>("/users", function* (ctx, next) {
  console.log("Creating folder", ctx);
  yield* schema.update((root) => {
    const yarray = root.get("data").get("items");
    yarray.push([
      {
        id: Date.now().toString(),
        name: "New folder",
        children: [],
      },
    ]);
  });

  yield* next();
});
