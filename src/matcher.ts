import type { AnyAction } from "./types.js";

type ActionType = string;
type GuardPredicate<G extends T, T = unknown> = (arg: T) => arg is G;
type Predicate<Guard extends AnyAction = AnyAction> = (
  action: Guard,
) => boolean;
type StringableActionCreator<A extends AnyAction = AnyAction> = {
  (...args: never[]): A;
  toString(): string;
};
type SubPattern<Guard extends AnyAction = AnyAction> =
  | Predicate<Guard>
  | StringableActionCreator
  | ActionType;
/**
 * A `Pattern` can be an action type string, an action creator, a predicate
 * function, or an array containing any of those. It is used to match actions
 * in listeners and middleware.
 */
export type Pattern = SubPattern | SubPattern[];
type ActionSubPattern<Guard extends AnyAction = AnyAction> =
  | GuardPredicate<Guard, AnyAction>
  | StringableActionCreator<Guard>
  | Predicate<Guard>
  | ActionType;
export type ActionPattern<Guard extends AnyAction = AnyAction> =
  | ActionSubPattern<Guard>
  | ActionSubPattern<Guard>[];

function isThunk(fn: unknown): fn is StringableActionCreator & {
  run: unknown;
  use: unknown;
  name: string;
} {
  if (typeof fn !== "function") return false;

  const thunk = fn as {
    run?: unknown;
    use?: unknown;
    name?: unknown;
    toString?: unknown;
  };

  return (
    typeof thunk.run === "function" &&
    typeof thunk.use === "function" &&
    typeof thunk.name === "string" &&
    typeof thunk.toString === "function"
  );
}

function isActionCreator(fn: unknown): fn is StringableActionCreator {
  return (
    !!fn && typeof fn === "function" && "_starfx" in fn && fn._starfx === true
  );
}

/**
 * Build a predicate that returns `true` when an action matches `pattern`.
 *
 * @param pattern - A string, action-creator, predicate, or array of those.
 * @returns A predicate function accepting an action and returning a boolean.
 */
export function matcher(pattern: ActionPattern): Predicate {
  if (pattern === "*") {
    return (input) => !!input;
  }

  if (typeof pattern === "string") {
    return (input) => pattern === input.type;
  }

  if (Array.isArray(pattern)) {
    return (input) => pattern.some((p) => matcher(p)(input));
  }

  if (isThunk(pattern)) {
    return (input) => pattern.toString() === input.type;
  }

  if (typeof pattern === "function" && !isActionCreator(pattern)) {
    return (input) => pattern(input) as boolean;
  }

  if (isActionCreator(pattern)) {
    return (input: AnyAction) => pattern.toString() === input.type;
  }

  throw new Error("invalid pattern");
}
