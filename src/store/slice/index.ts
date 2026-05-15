import { type AnyOutput, any } from "./any.js";
import {
  type LoaderOutput,
  defaultLoader,
  defaultLoaderItem,
  loaders,
} from "./loaders.js";
import { type NumOutput, num } from "./num.js";
import { type ObjOutput, obj } from "./obj.js";
import { type StrOutput, str } from "./str.js";
import { type TableOutput, cache, table } from "./table.js";

export const slice = {
  str,
  num,
  table,
  cache,
  any,
  obj,
  loaders,
};
export { defaultLoader, defaultLoaderItem };
export type {
  AnyOutput,
  LoaderOutput,
  NumOutput,
  ObjOutput,
  StrOutput,
  TableOutput,
};
