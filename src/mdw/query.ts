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
 * Error-catching middleware that logs exceptions and sets `ctx.result`.
 *
 * @remarks
 * Wraps the entire middleware pipeline in error handling. If any downstream
 * middleware throws, the error is caught, logged to console with context,
 * and an `error:query` action is dispatched.
 *
 * Sets `ctx.result` to a {@link Result} indicating pipeline success/failure.
 * This is analogous to `.catch()` for `window.fetch`.
 *
 * You are encouraged to replace this middleware if you need custom error
 * handling (e.g., error reporting services, different logging).
 *
 * @typeParam Ctx - The thunk context type.
 *
 * @example
 * ```ts
 * const thunks = createThunks();
 * thunks.use(mdw.err); // Catches and logs errors
 * thunks.use(thunks.routes());
 * ```
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
 * Middleware that allows overriding the default action key.
 *
 * @remarks
 * By default, the `key` is a hash of the action type and payload. This
 * middleware lets you set a custom key by modifying `ctx.key` in an earlier
 * middleware or the thunk handler.
 *
 * Custom keys are useful when you need different cache entries for the
 * same payload, or when integrating with external systems that expect
 * specific identifiers.
 *
 * @typeParam Ctx - The thunk context type.
 *
 * @example
 * ```ts
 * const thunks = createThunks();
 * thunks.use(mdw.customKey);
 *
 * const fetch = thunks.create('fetch', function* (ctx, next) {
 *   // Override the default key
 *   ctx.key = `custom-${ctx.payload.id}`;
 *   yield* next();
 * });
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
 * Initialize API context properties required by {@link createApi}.
 *
 * @remarks
 * Sets up the following context properties if not already present:
 * - `ctx.req()` - Helper function to merge request options
 * - `ctx.request` - The fetch Request object
 * - `ctx.response` - The fetch Response (initially null)
 * - `ctx.json` - The parsed JSON response as a Result
 * - `ctx.actions` - Array of actions to batch dispatch
 * - `ctx.bodyType` - Response body parsing method (default: 'json')
 *
 * This middleware is included in {@link mdw.api} and is required for
 * API endpoints to function properly.
 *
 * @typeParam Ctx - The API context type.
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
 * Batch dispatch accumulated actions after middleware completes.
 *
 * @remarks
 * Collects actions added to `ctx.actions` array during the middleware
 * pipeline and dispatches them as a single batch at the end. This improves
 * performance by reducing the number of store updates.
 *
 * Add actions to `ctx.actions` anywhere in the pipeline, and this middleware
 * will dispatch them all at once after downstream middleware completes.
 *
 * This middleware is included in {@link mdw.api}.
 *
 * @example
 * ```ts
 * function* myMiddleware(ctx, next) {
 *   ctx.actions.push({ type: 'USER_LOADED', payload: user });
 *   ctx.actions.push({ type: 'STATS_UPDATED', payload: stats });
 *   yield* next();
 *   // Both actions dispatched as a batch after this
 * }
 * ```
 */
export function* actions(ctx: { actions: AnyAction[] }, next: Next) {
  if (!ctx.actions) ctx.actions = [];
  yield* next();
  if (ctx.actions.length === 0) return;
  yield* put(ctx.actions);
}

/**
 * Measure pipeline execution time with `performance.now()`.
 *
 * @remarks
 * Records the start time before calling `next()` and calculates the elapsed
 * time after all downstream middleware complete. The result is stored in
 * `ctx.performance` (milliseconds).
 *
 * Useful for debugging slow endpoints or monitoring API performance.
 *
 * @typeParam Ctx - The context type with `performance` property.
 *
 * @example
 * ```ts
 * const api = createApi();
 * api.use(mdw.perf);
 * api.use(api.routes());
 *
 * const fetchUsers = api.get('/users', function* (ctx, next) {
 *   yield* next();
 *   console.log(`Request took ${ctx.performance}ms`);
 * });
 * ```
 */
export function* perf<Ctx extends PerfCtx = PerfCtx>(ctx: Ctx, next: Next) {
  const t0 = performance.now();
  yield* next();
  const t1 = performance.now();
  ctx.performance = t1 - t0;
}

/**
 * Composed middleware for making fetch requests with {@link createApi}.
 *
 * @remarks
 * This middleware composes several fetch-related middlewares:
 * - {@link composeUrl} - Prepends `baseUrl` to request URLs
 * - {@link payload} - Validates URL parameters against payload
 * - {@link request} - Executes the actual `fetch()` call
 * - {@link json} - Parses the response body
 *
 * Use this as the final middleware in your API stack to handle the
 * actual HTTP request.
 *
 * @param options - Configuration options.
 * @param options.baseUrl - Base URL to prepend to all requests (default: '').
 * @returns A composed middleware function.
 *
 * @see {@link mdw.api} for the full recommended middleware stack.
 * @see {@link https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API | Fetch API}
 *
 * @example
 * ```ts
 * const api = createApi();
 * api.use(mdw.api({ schema }));
 * api.use(api.routes());
 * api.use(mdw.fetch({ baseUrl: 'https://api.example.com' }));
 * ```
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
 * Conditionally execute middleware based on a predicate.
 *
 * @remarks
 * Wraps another middleware and only executes it if the predicate returns `true`.
 * If the predicate returns `false`, control passes directly to `next()`.
 *
 * The predicate can be synchronous or an async operation.
 *
 * @typeParam Ctx - The API context type.
 * @param predicate - Function or operation that returns whether to run the middleware.
 * @returns A middleware wrapper function.
 *
 * @example Skip middleware for certain requests
 * ```ts
 * const skipForAdmin = mdw.predicate(
 *   (ctx) => !ctx.payload.isAdmin
 * );
 *
 * api.use(skipForAdmin(mdw.rateLimit()));
 * ```
 *
 * @example Async predicate
 * ```ts
 * const onlyWhenOnline = mdw.predicate(function* (ctx) {
 *   const isOnline = yield* select(selectIsOnline);
 *   return isOnline;
 * });
 * ```
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
