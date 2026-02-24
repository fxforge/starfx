import type { Operation } from "effection";

export type Next = () => Operation<void>;

export type IdProp = string | number;
export type LoadingStatus = "loading" | "success" | "error" | "idle";
export interface LoaderItemState {
  id: string;
  status: LoadingStatus;
  message: string;
  lastRun: number;
  lastSuccess: number;
  // biome-ignore lint/suspicious/noExplicitAny: allow anything but can't be generic per this type
  meta: Record<string, any>;
}

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

export interface Action {
  type: string;
  // biome-ignore lint/suspicious/noExplicitAny: allow anything from the user
  [extraProps: string]: any;
}

export type ActionFn = () => { toString: () => string };
export type ActionFnWithPayload<PayloadContent = unknown> = (
  p: PayloadContent,
) => {
  toString: () => string;
};

// https://github.com/redux-utilities/flux-standard-action
export interface AnyAction extends Action {
  // biome-ignore lint/suspicious/noExplicitAny: : allow anything from the user, but also define type with generic payload
  payload?: any;
  // biome-ignore lint/suspicious/noExplicitAny: : allow anything from the user
  meta?: Record<string, any>;
  error?: boolean;
}

export interface ActionWithPayload<PayloadContent> extends AnyAction {
  payload: PayloadContent;
}
