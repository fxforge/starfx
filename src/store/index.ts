import { any } from "./slice/any.js";
import { loaders } from "./slice/loaders.js";
import { num } from "./slice/num.js";
import { obj } from "./slice/obj.js";
import { str } from "./slice/str.js";
import { table } from "./slice/table.js";

export { createSchema } from "./schema.js";
export {
  createStore,
  configureStore,
  IdContext,
  type CreateStore,
} from "./store.js";
export const slice = {
  str,
  num,
  table,
  any,
  obj,
  loaders,
  /**
   * @deprecated Use `slice.loaders` instead
   */
  loader: loaders,
};

export { defaultLoader, defaultLoaderItem } from "./slice/loaders.js";
export type { AnyOutput } from "./slice/any.js";
export type { LoaderOutput } from "./slice/loaders.js";
export type { NumOutput } from "./slice/num.js";
export type { ObjOutput } from "./slice/obj.js";
export type { StrOutput } from "./slice/str.js";
export type { TableOutput } from "./slice/table.js";

export * from "./types.js";
export * from "./context.js";
export * from "./fx.js";
export { createSelector } from "reselect";
export * from "./batch.js";
export * from "./persist.js";
