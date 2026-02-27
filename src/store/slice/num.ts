import type { Draft, Immutable } from "immer";
import type { BaseSchema, SliceState } from "../types.js";

type NumRootState = SliceState<number>;

export interface NumActions {
  set: (v: number) => (s: Draft<NumRootState>) => void;
  reset: () => (s: Draft<NumRootState>) => void;
  increment: (by?: number) => (s: Draft<NumRootState>) => void;
  decrement: (by?: number) => (s: Draft<NumRootState>) => void;
}

export interface NumSelectors {
  select: (s: Immutable<NumRootState>) => number;
}

export interface NumOutput
  extends BaseSchema<number>,
    NumActions,
    NumSelectors {
  schema: "num";
  initialState: number;
}

export function createNum({
  name,
  initialState = 0,
}: {
  name: keyof NumRootState;
  initialState?: number;
}): NumOutput {
  return {
    name: String(name),
    schema: "num",
    initialState,
    set: (value) => (state) => {
      state[name] = value;
    },
    increment:
      (by = 1) =>
      (state) => {
        state[name] += by;
      },
    decrement:
      (by = 1) =>
      (state) => {
        state[name] -= by;
      },
    reset: () => (state) => {
      state[name] = initialState;
    },
    select: (state) => state[name],
  } satisfies NumOutput;
}

/**
 * Public numeric slice API used in `createSchema` definitions.
 *
 * @remarks
 * Great for counters, pagination indexes, and lightweight scalar state.
 *
 * @param initialState - Optional initial value for the slice.
 * @returns A factory consumed by `createSchema` with the slice name.
 *
 * @example
 * ```ts
 * const schema = createSchema({
 *   counter: slice.num(0),
 * });
 * ```
 */
export function num(initialState?: number) {
  return (name: string) => createNum({ name, initialState });
}
