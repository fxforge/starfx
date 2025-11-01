import { type Operation, call } from "effection";
import { put } from "../action.js";
import { compose } from "../compose.js";
import { safe } from "../fx/index.js";
import type {
  ApiCtx,
  ApiRequest,
  FetchJsonCtx,
  MiddlewareApi,
  PerfCtx,
  RequiredApiRequest,
  ThunkCtx,
} from "../query/types.js";
import { mergeRequest } from "../query/util.js";
import type { AnyAction, Next } from "../types.js";
import * as fetchMdw from "./fetch.js";
export * from "./fetch.js";

/**
 * This middleware will catch any errors in the pipeline
 * and `console.error` the context object.
 *
 * You are highly encouraged to ditch this middleware if you need something
 * more custom.
 *
 * It also sets `ctx.result` which informs us whether the entire
 * middleware pipeline succeeded or not. Think the `.catch()` case for
 * `window.fetch`.
 */
export function* err<Ctx extends ThunkCtx = ThunkCtx>(ctx: Ctx, next: Next) {
  ctx.result = yield* safe(next);
  if (!ctx.result.ok) {
    const message = `Error: ${ctx.result.error.message}.  Check the endpoint [${ctx.name}]`;
    console.error(message, ctx);
    yield* put({
      type: "error:query",
      payload: {
        message,
        ctx,
      },
    });
  }
}

/**
 * This middleware allows the user to override the default key provided
 * to every pipeline function and instead use whatever they want.
 *
 * @example
 * ```ts
 * import { createPipe } from 'starfx';
 *
 * const thunk = createPipe();
 * thunk.use(customKey);
 *
 * const doit = thunk.create('some-action', function*(ctx, next) {
 *   ctx.key = 'something-i-want';
 * })
 * ```
 */
export function* customKey<Ctx extends ThunkCtx = ThunkCtx>(
  ctx: Ctx,
  next: Next,
) {
  if (
    ctx?.key &&
    ctx?.action?.payload?.key &&
    ctx.key !== ctx.action.payload.key
  ) {
    const newKey = `${ctx.name.split("|")[0]}|${ctx.key}`;
    ctx.key = newKey;
    ctx.action.payload.key = newKey;
  }
  yield* next();
}

/**
 * This middleware sets up the context object with some values that are
 * necessary for {@link createApi} to work properly.
 */
export function* queryCtx<Ctx extends ApiCtx = ApiCtx>(ctx: Ctx, next: Next) {
  if (!ctx.req) {
    ctx.req = (r?: ApiRequest): RequiredApiRequest =>
      mergeRequest(ctx.request, r);
  }
  if (!ctx.request) ctx.request = ctx.req();
  if (!ctx.response) ctx.response = null;
  if (!ctx.json) ctx.json = { ok: false, error: {} };
  if (!ctx.actions) ctx.actions = [];
  if (!ctx.bodyType) ctx.bodyType = "json";
  yield* next();
}

/**
 * This middleware will take the result of `ctx.actions` and dispatch them
 * as a single batch.
 *
 * @remarks This is useful because sometimes there are a lot of actions that need dispatched
 * within the pipeline of the middleware and instead of dispatching them serially this
 * improves performance by only hitting the reducers once.
 */
export function* actions(ctx: { actions: AnyAction[] }, next: Next) {
  if (!ctx.actions) ctx.actions = [];
  yield* next();
  if (ctx.actions.length === 0) return;
  yield* put(ctx.actions);
}

/**
 * This middleware will add `performance.now()` before and after your
 * middleware pipeline.
 */
export function* perf<Ctx extends PerfCtx = PerfCtx>(ctx: Ctx, next: Next) {
  const t0 = performance.now();
  yield* next();
  const t1 = performance.now();
  ctx.performance = t1 - t0;
}

/**
 * This middleware is a composition of other middleware required to
 * use `window.fetch` {@link https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API}
 * with {@link createApi}
 */
export function fetch<CurCtx extends FetchJsonCtx = FetchJsonCtx>(
  {
    baseUrl = "",
  }: {
    baseUrl?: string;
  } = { baseUrl: "" },
) {
  return compose<CurCtx>([
    fetchMdw.composeUrl(baseUrl),
    fetchMdw.payload,
    fetchMdw.request,
    fetchMdw.json,
  ]);
}

/**
 * This middleware will only be activated if predicate is true.
 */
export function predicate<Ctx extends ApiCtx = ApiCtx>(
  predicate: ((ctx: Ctx) => boolean) | ((ctx: Ctx) => () => Operation<boolean>),
) {
  return (mdw: MiddlewareApi) => {
    return function* (ctx: Ctx, next: Next) {
      const valid = yield* call(() => predicate(ctx));
      if (!valid) {
        yield* next();
        return;
      }

      yield* mdw(ctx, next);
    };
  };
}
