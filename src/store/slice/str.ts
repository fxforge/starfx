import type { Draft, Immutable } from "immer";
import type { BaseSchema, SliceState } from "../types.js";

type StrRootState = SliceState<string>;

export interface StrActions {
  set: (v: string) => (s: Draft<StrRootState>) => void;
  reset: () => (s: Draft<StrRootState>) => void;
}

export interface StrSelectors {
  select: (s: Immutable<StrRootState>) => string;
}

export interface StrOutput
  extends BaseSchema<string>,
    StrActions,
    StrSelectors {
  schema: "str";
  initialState: string;
}

export function createStr({
  name,
  initialState = "",
}: {
  name: keyof StrRootState;
  initialState?: string;
}): StrOutput {
  return {
    schema: "str",
    name: String(name),
    initialState,
    set: (value) => (state) => {
      state[name] = value;
    },
    reset: () => (state) => {
      state[name] = initialState;
    },
    select: (state) => state[name],
  } satisfies StrOutput;
}

export function str(initialState?: string) {
  return (name: string) => createStr({ name, initialState });
}
