import type { AnyState } from "../../types.js";
import type { BaseSchema } from "../types.js";

export interface ObjOutput<V extends AnyState, S extends AnyState>
  extends BaseSchema<V> {
  schema: "obj";
  initialState: V;
  set: (v: V) => (s: S) => void;
  reset: () => (s: S) => void;
  update: <P extends keyof V>(prop: { key: P; value: V[P] }) => (s: S) => void;
  select: (s: S) => V;
}

export function createObj<V extends AnyState, S extends AnyState = AnyState>({
  name,
  initialState,
}: {
  name: keyof S;
  initialState: V;
}): ObjOutput<V, S> {
  return {
    schema: "obj",
    name: name as string,
    initialState,
    set: (value) => (state) => {
      (state as any)[name] = value;
    },
    reset: () => (state) => {
      (state as any)[name] = initialState;
    },
    update:
      <P extends keyof V>(prop: { key: P; value: V[P] }) =>
      (state) => {
        (state as any)[name][prop.key] = prop.value;
      },
    select: (state) => {
      return (state as any)[name];
    },
  };
}

export function obj<V extends AnyState>(initialState: V) {
  return (name: string) => createObj<V, AnyState>({ name, initialState });
}
