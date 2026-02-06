import type { AnyState } from "../../types.js";
import type { BaseSchema } from "../types.js";

export interface AnyOutput<V, S extends AnyState> extends BaseSchema<V> {
  schema: "any";
  initialState: V;
  set: (v: V) => (s: S) => void;
  reset: () => (s: S) => void;
  select: (s: S) => V;
}

/**
 * Create a generic slice for any arbitrary value.
 *
 * @param name - The state key for this slice.
 * @param initialState - The initial value for the slice.
 * @returns An `AnyOutput` providing setter, reset, and selector helpers.
 */
export function createAny<V, S extends AnyState = AnyState>({
  name,
  initialState,
}: {
  name: keyof S;
  initialState: V;
}): AnyOutput<V, S> {
  return {
    schema: "any",
    name: name as string,
    initialState,
    set: (value) => (state) => {
      (state as any)[name] = value;
    },
    reset: () => (state) => {
      (state as any)[name] = initialState;
    },
    select: (state) => {
      return (state as any)[name];
    },
  };
}

/**
 * Shortcut to define an `any` slice for schema creation.
 *
 * @param initialState - The initial value for the slice.
 */
export function any<V>(initialState: V) {
  return (name: string) => createAny<V, AnyState>({ name, initialState });
}
