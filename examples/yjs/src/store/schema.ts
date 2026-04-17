import {
  type FxMap,
  type FxSchema,
  type StoreUpdater,
  createSchemaWithUpdater,
  expectStore,
  type SliceFromSchema,
  createSignal,
  each,
} from "starfx";
import type { Draft } from "immer";
import * as Y from "yjs";

const SNAPSHOT = Symbol("yjs:snapshot");

type SnapshotUpdater<S extends Record<string, unknown>> = StoreUpdater<S> & {
  [SNAPSHOT]: true;
};

function createSnapshotUpdater<O extends FxMap>(
  snapshot: SliceFromSchema<O>,
): SnapshotUpdater<SliceFromSchema<O>> {
  return Object.assign(
    (draft: Draft<SliceFromSchema<O>>) => {
      const nextState = snapshot as Record<string, unknown>;
      const draftState = draft as Record<string, unknown>;

      for (const key of Object.keys(draftState)) {
        if (!(key in nextState)) {
          delete draftState[key];
        }
      }

      Object.assign(draftState, nextState);
    },
    { [SNAPSHOT]: true as const },
  );
}

function isSnapshotUpdater<O extends FxMap>(
  updater: unknown,
): updater is SnapshotUpdater<SliceFromSchema<O>> {
  return (
    typeof updater === "function" && Reflect.get(updater, SNAPSHOT) === true
  );
}

/**
 * Creates a Yjs-backed schema where state updates are synchronized via Y.Doc.
 * This demonstrates using createSchemaWithUpdater for custom state management.
 */
export function createYjsSchema<O extends FxMap>(slices: O): FxSchema<O> {
  console.log("Creating Y.Doc");
  const ydoc = new Y.Doc({ autoLoad: true });
  const root = ydoc.getMap();

  const data = new Y.Map();
  root.set("data", data);
  data.set("items", new Y.Array());

  return createSchemaWithUpdater(slices, {
    name: "yjs",
    initialize: function* () {
      const store = yield* expectStore<O>();
      const schema = store.schemas["yjs"];
      let observation = createSignal<{
        events: Y.YEvent<unknown>[];
        transaction: any// Y.Transaction is just unknown?
      }>();

      root.observeDeep(
        (events: Y.YEvent<unknown>[], transaction: Y.Transaction) => {
          if (typeof transaction === "object" && transaction !== null && "local" in transaction && !transaction.local) {
            console.log("Y.Doc changed, sending update", events, transaction);
            observation.send({ events, transaction });
          }
        },
      );

      yield* schema.update(
        createSnapshotUpdater(root.toJSON() as SliceFromSchema<O>),
      );

      for (const { events, transaction } of yield* each(observation)) {
        console.log(
          "Y.Doc changed, updating schema state",
          events,
          transaction,
        );
        yield* schema.update(
          createSnapshotUpdater(root.toJSON() as SliceFromSchema<O>),
        );
      }
    },
    *updateMdw(ctx, next) {
      const store = yield* expectStore<O>();
      const updaters = Array.isArray(ctx.updater) ? ctx.updater : [ctx.updater];

      const snapshotUpdaters = updaters.filter((updater) =>
        isSnapshotUpdater<O>(updater),
      );

      if (snapshotUpdaters.length > 0) {
        store.setState(snapshotUpdaters);
        yield* next();
        return;
      }

      ydoc.transact(() => {
        for (const updater of updaters) {
          (updater as (root: Y.Map<unknown>) => void)(root);
        }
      });

      store.setState([
        createSnapshotUpdater(root.toJSON() as SliceFromSchema<O>),
      ]);

      yield* next();
    },
  });
}

export { createYjsSchema as createSchema };
