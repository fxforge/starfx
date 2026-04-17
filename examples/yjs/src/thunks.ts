import { createThunks, mdw } from "starfx";
import { createSchema } from "./store/schema.js";
import { createTypedHooks } from "starfx/react";

// we could make special slices to help in handling Yjs updates,
// but this is enough to bootstrap it for the example.
// Internally we pass the updater the `ydoc` root, so we can
// directly manipulate Yjs data structures.
export const schema = createSchema({});
export type AppState = typeof schema.initialState;

export const thunks = createThunks();
// catch errors from task and logs them with extra info
thunks.use(mdw.err);
// where all the thunks get called in the middleware stack
thunks.use(thunks.routes());
thunks.use(function* (_ctx, next) {
  console.log("last mdw in the stack");
  yield* next();
});

type YjsRoot = {
  get(key: "data"): {
    get(key: "items"): {
      push(items: Array<{ id: string; name: string; children: unknown[] }>): void;
    };
  };
};

export const createFolder = thunks.create<any>("/users", function* (ctx, next) {
  console.log("Creating folder", ctx);
  yield* schema.update(((root: YjsRoot) => {
    const yarray = root.get("data").get("items");
    const dt = Date.now().toString();
    yarray.push([
      {
        id: dt,
        name: "New folder from " + dt,
        children: [],
      },
    ]);
  }) as never);

  yield* next();
});

export const { useSelector } = createTypedHooks(schema);

