import type { Operation } from "effection";

/**
 * Function passed to middleware to advance to the next operation in the stack.
 *
 * @remarks
 * Call `yield* next()` to pass control to the next middleware. Code after
 * the yield point executes after downstream middleware completes.
 */
export type Next = () => Operation<void>;

/**
 * Identifier type used in table slices (string | number).
 */
export type IdProp = string | number;

/**
 * Finite set of loader states used by query loaders.
 */
export type LoadingStatus = "loading" | "success" | "error" | "idle";

/**
 * Minimal state tracked for each loader instance.
 *
 * @remarks
 * This is the raw state stored in the loader table. For a consumer-facing
 * shape with convenience booleans, see {@link LoaderState}.
 */
export interface LoaderItemState {
  /** Unique loader id derived from action key/payload */
  id: string;
  /** Current loader status */
  status: LoadingStatus;
  /** Optional message for errors or info */
  message: string;
  /** Timestamp of the last run (ms since epoch) */
  lastRun: number;
  /** Timestamp of the last successful run */
  lastSuccess: number;
  /** Arbitrary metadata attached to the loader */
  // biome-ignore lint/suspicious/noExplicitAny: allow anything but can't be generic per this type
  meta: Record<string, any>;
}

/**
 * Extended loader state with convenience boolean properties.
 *
 * @remarks
 * Adds computed booleans for easy status checks:
 * - `isIdle`
 * - `isLoading`
 * - `isSuccess`
 * - `isError`
 * - `isInitialLoading`
 */
export interface LoaderState extends LoaderItemState {
  isIdle: boolean;
  isLoading: boolean;
  isError: boolean;
  isSuccess: boolean;
  isInitialLoading: boolean;
}

export type LoaderPayload = Pick<LoaderItemState, "id"> &
  Partial<Pick<LoaderItemState, "message" | "meta">>;

// this type is too broad, do not use it. Likely to be removed in the future.
export type AnyState = Record<string, any>;

export interface Payload<PayloadContent> {
  payload: PayloadContent;
}

/**
 * Basic action shape used throughout the library.
 *
 * @remarks
 * Actions are plain objects with a `type` string that identifies behavior.
 */
export interface Action {
  /** Action type string */
  type: string;
  // biome-ignore lint/suspicious/noExplicitAny: allow anything from the user
  [extraProps: string]: any;
}

/**
 * An action creator with no payload.
 */
export type ActionFn = () => { toString: () => string };

/**
 * An action creator that accepts a payload.
 */
export type ActionFnWithPayload<PayloadContent = unknown> = (
  p: PayloadContent,
) => {
  toString: () => string;
};

// https://github.com/redux-utilities/flux-standard-action
/**
 * Flux Standard Action (FSA) compatible action type.
 *
 * @remarks
 * Extends {@link Action} with optional payload/meta/error fields.
 */
export interface AnyAction extends Action {
  // biome-ignore lint/suspicious/noExplicitAny: : allow anything from the user, but also define type with generic payload
  payload?: any;
  // biome-ignore lint/suspicious/noExplicitAny: : allow anything from the user
  meta?: Record<string, any>;
  error?: boolean;
}

/**
 * AnyAction with an explicitly typed `payload`.
 */
export interface ActionWithPayload<PayloadContent> extends AnyAction {
  payload: PayloadContent;
}
