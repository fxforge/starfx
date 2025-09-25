import * as Y from "yjs";
import type { AnyState, UpdaterCtx, Next, Operation } from "starfx";

export const defaultStoreUpdater = <S extends AnyState>(
  setState: (state: S) => void,
  getState: () => S
) => {
  console.log("Creating Y.Doc");
  const ydoc = new Y.Doc({ autoLoad: true });
  const root = ydoc.getMap();

  const data = new Y.Map();
  root.set("data", data);
  data.set("items", new Y.Array());

  root.observeDeep((events, transaction) => {
    console.log("Y.Doc changed", { events, transaction });
    setState(root.toJSON() as S);
  });

  function* updateMdw(ctx: UpdaterCtx<S>, next: Next) {
    ydoc.transact(() => ctx.updater(root));
    console.log({ updater: ctx.updater });
    setState(root.toJSON() as S);
    yield* next();
  }

  const initializeStore: () => Operation<void> = function* () {
    setState(root.toJSON() as S);
  };
  return { updateMdw, initializeStore };
};
