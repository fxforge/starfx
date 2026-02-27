import {
  type FxMap,
  type FxSchema,
  type Next,
  type UpdaterCtx,
  type FxStore,
  createSchemaWithUpdater,
} from "starfx";
import * as Y from "yjs";

/**
 * Creates a Yjs-backed schema where state updates are synchronized via Y.Doc.
 * This demonstrates using createSchemaWithUpdater for custom state management.
 */
export function createYjsSchema<
  O extends FxMap,
  S extends { [key in keyof O]: ReturnType<O[key]>["initialState"] },
>(slices: O): FxSchema<S, O> {
  console.log("Creating Y.Doc");
  const ydoc = new Y.Doc({ autoLoad: true });
  const root = ydoc.getMap();

  const data = new Y.Map();
  root.set("data", data);
  data.set("items", new Y.Array());

  return createSchemaWithUpdater(slices, {
    createUpdateMdw: (store: FxStore<S>) => {
      // Set up observer to sync Y.Doc changes to store
      root.observeDeep(
        (events: Y.YEvent<any>[], transaction: Y.Transaction) => {
          console.log("Y.Doc changed", { events, transaction });
          store.setState(root.toJSON() as S);
        },
      );

      // Initialize store with current Y.Doc state
      store.setState(root.toJSON() as S);

      return function* updateMdw(ctx: UpdaterCtx<S>, next: Next) {
        ydoc.transact(() => {
          const updaters = Array.isArray(ctx.updater)
            ? ctx.updater
            : [ctx.updater];
          for (const updater of updaters) {
            updater(root as any);
          }
        });
        console.log({ updater: ctx.updater });
        store.setState(root.toJSON() as S);
        yield* next();
      };
    },
  });
}

// For backwards compatibility, also export as createSchema
export { createYjsSchema as createSchema };
