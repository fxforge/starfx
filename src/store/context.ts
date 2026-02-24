import { type Channel, createChannel, createContext } from "effection";
import type { FxMap, FxStore } from "./types.js";

export const StoreUpdateContext = createContext<Channel<void, void>>(
  "starfx:store:update",
  createChannel<void, void>(),
);
export const StoreContext = createContext<FxStore<FxMap>>("starfx:store");

export function* expectStore<O extends FxMap = FxMap>() {
  return (yield* StoreContext.expect()) as FxStore<O>;
}
