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

export function any<V>(initialState: V) {
  return (name: string) => createAny<V>({ name, initialState });
}
