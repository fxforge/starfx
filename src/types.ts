import type { Operation } from "effection";

/**
 * Function passed to middleware to advance to the next operation in the stack.
 *
 * @remarks
 * Call `yield* next()` to pass control to the next middleware. Code after
 * the yield point executes after all downstream middleware have completed.
 * Not calling `next()` exits the middleware stack early.
 *
 * @example
 * ```ts
 * function* myMiddleware(ctx, next) {
 *   console.log('before');
 *   yield* next();  // Call next middleware
 *   console.log('after');
 * }
 * ```
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
 * Minimal state tracked for each loader instance (internal representation).
 *
 * @remarks
 * This is the raw state stored in the loaders slice. For consumer-facing
 * state with convenience booleans, see {@link LoaderState}.
 *
 * @typeParam M - Shape of the `meta` object for custom metadata.
 */
export interface LoaderItemState<
  M extends Record<string, unknown> = Record<IdProp, unknown>,
> {
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
  meta: M;
}

/**
 * Extended loader state with convenience boolean properties.
 *
 * @remarks
 * This is the type returned by loader selectors and hooks. It extends
 * {@link LoaderItemState} with computed booleans for easy status checking:
 *
 * - `isIdle` - Initial state, operation hasn't started
 * - `isLoading` - Currently executing
 * - `isSuccess` - Completed successfully
 * - `isError` - Failed with an error
 * - `isInitialLoading` - Loading AND has never succeeded before
 *
 * The `isInitialLoading` property is useful for showing loading UI only
 * on the first fetch, while displaying stale data during refreshes.
 *
 * @typeParam M - Shape of the `meta` object for custom metadata.
 */
export interface LoaderState<M extends AnyState = AnyState>
  extends LoaderItemState<M> {
  isIdle: boolean;
  isLoading: boolean;
  isError: boolean;
  isSuccess: boolean;
  isInitialLoading: boolean;
}

export type LoaderPayload<M extends AnyState> = Pick<LoaderItemState<M>, "id"> &
  Partial<Pick<LoaderItemState<M>, "message" | "meta">>;

export type AnyState = Record<string, any>;

export interface Payload<P = any> {
  payload: P;
}

/**
 * Basic action shape used throughout the library.
 *
 * @remarks
 * Actions are plain objects with a `type` string that identifies the action.
 * This follows the Flux Standard Action pattern.
 *
 * @see {@link AnyAction} for actions with optional payload/meta.
 * @see {@link ActionWithPayload} for actions with typed payload.
 */
export interface Action {
  /** Action type string */
  type: string;
  [extraProps: string]: any;
}

/**
 * An action creator with no payload.
 */
export type ActionFn = () => { toString: () => string };

/**
 * An action creator that accepts a payload.
 */
export type ActionFnWithPayload<P = any> = (p: P) => { toString: () => string };

// https://github.com/redux-utilities/flux-standard-action
/**
 * Flux Standard Action (FSA) compatible action type.
 *
 * @remarks
 * Extends {@link Action} with optional FSA properties:
 * - `payload` - The action's data payload
 * - `meta` - Additional metadata
 * - `error` - If true, `payload` is an Error object
 *
 * While not strictly required, keeping actions JSON serializable is
 * highly recommended for debugging and time-travel features.
 *
 * @see {@link https://github.com/redux-utilities/flux-standard-action | FSA Spec}
 */
export interface AnyAction extends Action {
  payload?: any;
  meta?: any;
  error?: boolean;
  [extraProps: string]: any;
}

/**
 * AnyAction with an explicitly typed `payload`.
 */
export interface ActionWithPayload<P> extends AnyAction {
  payload: P;
}
