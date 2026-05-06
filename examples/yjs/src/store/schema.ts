import {
  baseMiddlewares,
  compose,
  type FxMap,
  type FxSchema,
  type FxStore,
  type Next,
  type SchemaUpdater,
  type StoreUpdater,
  type UpdaterCtx,
  createSchemaWithUpdater,
  expectStore,
  type SliceFromSchema,
  createSignal,
  each,
} from "starfx";
import type { Draft } from "immer";
import * as Y from "yjs";

function createSnapshotUpdater<O extends FxMap>(
  snapshot: SliceFromSchema<O>,
): StoreUpdater<SliceFromSchema<O>> {
  return (draft: Draft<SliceFromSchema<O>>) => {
    const nextState = snapshot as Record<string, unknown>;
    const draftState = draft as Record<string, unknown>;

    for (const key of Object.keys(draftState)) {
      if (!(key in nextState)) {
        delete draftState[key];
      }
    }

    Object.assign(draftState, nextState);
  };
}

function* reconcileSnapshot<O extends FxMap>(
  store: FxStore<O>,
  snapshot: SliceFromSchema<O>,
) {
  const updater = createSnapshotUpdater(snapshot);
  const ctx: UpdaterCtx<
    SliceFromSchema<O>,
    SchemaUpdater<O> | SchemaUpdater<O>[]
  > = {
    updater,
    patches: [],
  };

  const applySnapshot = function*(
    innerCtx: UpdaterCtx<
      SliceFromSchema<O>,
      SchemaUpdater<O> | SchemaUpdater<O>[]
    >,
    next: Next,
  ) {
    const [_nextState, patches] = store.setState([
      updater as StoreUpdater<SliceFromSchema<O>>,
    ]);
    innerCtx.patches = patches;
    yield* next();
  };

  const runSnapshotMdw = compose<
    UpdaterCtx<SliceFromSchema<O>, SchemaUpdater<O> | SchemaUpdater<O>[]>
  >([
    applySnapshot,
    ...baseMiddlewares,
  ]);

  yield* runSnapshotMdw(ctx);
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
    *initialize() {
      const store = yield* expectStore<O>();
      const observation = createSignal<{
        events: Y.YEvent<Y.AbstractType<unknown>>[];
        transaction: Y.Transaction;
      }>();

      root.observeDeep(
        (
          events: Y.YEvent<Y.AbstractType<unknown>>[],
          transaction: Y.Transaction,
        ) => {
          // Only forward remote Yjs transactions; local ones already flow
          // through updateMdw and do not need a second reconciliation pass.
          if (typeof transaction === "object" && transaction !== null && "local" in transaction && !transaction.local) {
            console.log("Y.Doc changed, sending update", events, transaction);
            observation.send({ events, transaction });
          }
        },
      );

      yield* reconcileSnapshot(store, root.toJSON() as SliceFromSchema<O>);

      for (const { events, transaction } of yield* each(observation)) {
        console.log(
          "Y.Doc changed, updating schema state",
          events,
          transaction,
        );
        yield* reconcileSnapshot(store, root.toJSON() as SliceFromSchema<O>);
      }
    },
    *updateMdw(ctx, next) {
      const store = yield* expectStore<O>();
      const updaters = Array.isArray(ctx.updater) ? ctx.updater : [ctx.updater];

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
