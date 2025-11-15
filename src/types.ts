import type { Operation } from "effection";

export type Next = () => Operation<void>;

export type IdProp = string | number;
export type LoadingStatus = "loading" | "success" | "error" | "idle";
export interface LoaderItemState<
  M extends Record<string, unknown> = Record<IdProp, unknown>,
> {
  id: string;
  status: LoadingStatus;
  message: string;
  lastRun: number;
  lastSuccess: number;
  meta: M;
}

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

export interface Action {
  type: string;
  [extraProps: string]: any;
}

export type ActionFn = () => { toString: () => string };
export type ActionFnWithPayload<P = any> = (p: P) => { toString: () => string };

// https://github.com/redux-utilities/flux-standard-action
export interface AnyAction extends Action {
  payload?: any;
  meta?: any;
  error?: boolean;
  [extraProps: string]: any;
}

export interface ActionWithPayload<P> extends AnyAction {
  payload: P;
}
