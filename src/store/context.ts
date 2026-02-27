import { type Channel, createChannel, createContext } from "effection";
import type { FxMap, FxStore } from "./types.js";

/**
 * Channel used to notify that the store update sequence completed.
 *
 * Consumers may `StoreUpdateContext.expect()` this context to access
 * store lifecycle notifications through the channel.
 */
export const StoreUpdateContext = createContext<Channel<void, void>>(
  "starfx:store:update",
  createChannel<void, void>(),
);

/**
 * Context that holds the active `FxStore` for the current scope.
 *
 * Use `expectStore()` within operations to access the store instance.
 */
export const StoreContext = createContext<FxStore<FxMap>>("starfx:store");

export function* expectStore<O extends FxMap = FxMap>() {
  return (yield* StoreContext.expect()) as FxStore<O>;
}
