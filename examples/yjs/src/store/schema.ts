import {
  type FxMap,
  type FxSchema,
  createSchemaWithUpdater,
  expectStore,
  type SliceFromSchema,
} from "starfx";
import * as Y from "yjs";

/**
 * Creates a Yjs-backed schema where state updates are synchronized via Y.Doc.
 * This demonstrates using createSchemaWithUpdater for custom state management.
 */
export function createYjsSchema<
  O extends FxMap,
>(slices: O): FxSchema<O> {
  console.log("Creating Y.Doc");
  const ydoc = new Y.Doc({ autoLoad: true });
  const root = ydoc.getMap();

  const data = new Y.Map();
  root.set("data", data);
  data.set("items", new Y.Array());

  return createSchemaWithUpdater(slices, {
    initialize: function* () {
      const store = yield* expectStore<O>();

      root.observeDeep((_events: Y.YEvent<unknown>[], _transaction: Y.Transaction) => {
        store.setState(root.toJSON() as SliceFromSchema<O>);
      });

      store.setState(root.toJSON() as SliceFromSchema<O>);
    },
    *updateMdw(ctx, next) {
      const store = yield* expectStore<O>();

      ydoc.transact(() => {
        const updaters = Array.isArray(ctx.updater)
          ? ctx.updater
          : [ctx.updater];
        for (const updater of updaters) {
          (updater as (root: Y.Map<unknown>) => void)(root);
        }
      });

      store.setState(root.toJSON() as SliceFromSchema<O>);
      yield* next();
    },
  });
}

export { createYjsSchema as createSchema };
