import type { Draft, Immutable } from "immer";
import type { BaseSchema, SliceState } from "../types.js";

type AnyRootState<V> = SliceState<V>;

export interface AnyActions<V = unknown> {
  set: (v: V) => (s: Draft<AnyRootState<V>>) => void;
  reset: () => (s: Draft<AnyRootState<V>>) => void;
}

export interface AnySelectors<V = unknown> {
  select: (s: AnyRootState<V>) => Immutable<V>;
}

// export interface AnyOutput<V, S extends AnyState> extends BaseSchema<V> {
//   schema: "any";
//   initialState: V;
//   set: (v: V) => (s: S) => void;
//   reset: () => (s: S) => void;
//   select: (s: S) => V;
// }

export interface AnyOutput<V = unknown>
  extends BaseSchema<V>,
    AnyActions<V>,
    AnySelectors<V> {
  schema: "any";
  initialState: V;
}

export function createAny<V>({
  name,
  initialState,
}: {
  name: keyof AnyRootState<V>;
  initialState: V;
}): AnyOutput<V> {
  return {
    schema: "any",
    name: String(name),
    initialState,
    set: (value) => (state) => {
      Object.assign(state, { [name]: value });
    },
    reset: () => (state) => {
      Object.assign(state, { [name]: initialState });
    },
    select: (state) => state[name],
  } satisfies AnyOutput<V>;
}

/**
 * Public API for creating a generic unconstrained-value slice in `createSchema`.
 *
 * @remarks
 * Use this when the slice shape is intentionally open-ended.
 * For richer semantics, prefer dedicated slices like `table`, `obj`, or `num`.
 *
 * @param initialState - The initial value for the slice.
 * @returns A factory consumed by `createSchema` with the slice name.
 *
 * @example
 * ```ts
 * const schema = createSchema({
 *   runtime: slice.any<Record<string, unknown>>({}),
 * });
 * ```
 */
export function any<V>(initialState: V) {
  return (name: string) => createAny<V>({ name, initialState });
}
