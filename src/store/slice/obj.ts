import type { Draft, Immutable } from "immer";
import type { BaseSchema, SliceState } from "../types.js";

// biome-ignore lint/suspicious/noExplicitAny: this data could be shape as defined by the user and doesn't necessarily match between items (so no generic can be used)
type ObjBase = Record<string, any>;

export interface ObjActions<V extends ObjBase> {
  set: (v: V) => (s: Draft<SliceState<V>>) => void;
  reset: () => (s: Draft<SliceState<V>>) => void;
  update: <P extends keyof V>(prop: {
    key: P;
    value: V[P];
  }) => (s: Draft<SliceState<V>>) => void;
}

export interface ObjSelectors<V extends ObjBase> {
  select: (s: SliceState<V>) => Immutable<V>;
}

export interface ObjOutput<V extends ObjBase>
  extends BaseSchema<V>,
    ObjActions<V>,
    ObjSelectors<V> {
  schema: "obj";
  initialState: V;
}

export function createObj<V extends ObjBase>({
  name,
  initialState,
}: {
  name: keyof SliceState<V>;
  initialState: V;
}): ObjOutput<V> {
  const objInitialState: V = initialState ?? ({} as V);

  return {
    schema: "obj",
    name: String(name),
    initialState: objInitialState,
    set: (value) => (state) => {
      Object.assign(state, { [name]: value });
    },
    reset: () => (state) => {
      Object.assign(state, { [name]: initialState });
    },
    update: (prop) => (state) => {
      const target = state[name];
      if (target && typeof target === "object") {
        Object.assign(target, { [prop.key]: prop.value });
      } else {
        Object.assign(state, { [name]: { [prop.key]: prop.value } });
      }
    },
    select: (state) => state[name],
  } satisfies ObjOutput<V>;
}

export function obj<V extends ObjBase>(initialState: V) {
  return (name: string) => createObj<V>({ name, initialState });
}
