export * from "./fx/index.js";
export * from "./query/index.js";
export * from "./store/index.js";
export * from "./mdw/index.js";

export * from "./types.js";
export * from "./compose.js";
export * from "./action.js";
export * from "./supervisor.js";

/**
 * @deprecated `effection` is now a peer dependency. Import these symbols
 * directly from `effection` instead.
 */
export {
  action,
  call,
  createChannel,
  createContext,
  createQueue,
  createScope,
  createSignal,
  each,
  ensure,
  Err,
  Ok,
  race,
  resource,
  run,
  sleep,
  spawn,
  until,
  useAbortSignal,
} from "effection";

/**
 * @deprecated Effection types are provided by the peer dependency `effection`.
 * Import them directly from `effection` instead.
 */
export type {
  Callable,
  Channel,
  Operation,
  Result,
  Scope,
  Stream,
  Subscription,
  Task,
} from "effection";
