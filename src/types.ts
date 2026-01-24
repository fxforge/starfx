import type { Operation } from "effection";

/**
 * Function used by middleware chains to advance to the next operation.
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
 * Extended loader state used by consumer hooks (convenience booleans).
 */
export interface LoaderState<
  M extends AnyState = AnyState,
> extends LoaderItemState<M> {
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
 * Basic action shape used by the library.
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
 * Extended action which may carry payload/meta/error in FSA style.
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
