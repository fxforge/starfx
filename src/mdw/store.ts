import { compose } from "../compose.js";
import type { ApiCtx, ThunkCtxWLoader } from "../query/index.js";
import {
  type LoaderOutput,
  type TableOutput,
  select,
  updateStore,
} from "../store/index.js";
import type { AnyState, LoaderState, Next } from "../types.js";
import { nameParser } from "./fetch.js";
import { actions, customKey, err, queryCtx } from "./query.js";

export interface ApiMdwProps<Ctx extends ApiCtx = ApiCtx> {
  schema: {
    loaders: LoaderOutput;
    cache: TableOutput;
  };
  errorFn?: (ctx: Ctx) => string;
}

interface ErrorLike {
  message: string;
}

function isErrorLike(err: unknown): err is ErrorLike {
  return typeof err === "object" && err !== null && "message" in err;
}

/**
 * Composed middleware stack recommended for {@link createApi}.
 *
 * @remarks
 * This middleware composes the standard middleware needed for API endpoints:
 * - {@link mdw.err} - Error catching and logging
 * - {@link mdw.actions} - Batch action dispatch
 * - {@link mdw.queryCtx} - Initialize API context
 * - {@link mdw.customKey} - Custom key support
 * - {@link mdw.nameParser} - Parse URL and method from action name
 * - {@link mdw.loaderApi} - Automatic loader state tracking
 * - {@link mdw.cache} - Response caching
 *
 * This provides a battle-tested, production-ready setup for API requests.
 *
 * @typeParam Ctx - The API context type.
 * @typeParam S - The store state type.
 * @param props - Configuration options.
 * @param props.schema - The schema containing `loaders` and `cache` slices.
 * @param props.errorFn - Optional custom function to extract error messages.
 * @returns A composed middleware function.
 *
 * @see {@link createApi} for creating API endpoints.
 * @see {@link mdw.fetch} for the fetch middleware to add after this.
 *
 * @example Standard setup
 * ```ts
 * const api = createApi();
 * api.use(mdw.api({ schema }));
 * api.use(api.routes());
 * api.use(mdw.fetch({ baseUrl: 'https://api.example.com' }));
 * ```
 */
export function api<Ctx extends ApiCtx = ApiCtx>(props: ApiMdwProps<Ctx>) {
  return compose<Ctx>([
    err,
    actions,
    queryCtx,
    customKey,
    nameParser,
    loaderApi(props),
    cache(props.schema),
  ]);
}

/**
 * Automatically cache API response data.
 *
 * @remarks
 * When `ctx.cache` is truthy (set by `api.cache()` or manually), this
 * middleware stores the response JSON in the `cache` slice keyed by `ctx.key`.
 *
 * Before the request, it loads any existing cached data into `ctx.cacheData`.
 * After the request, if caching is enabled, it stores the new response.
 *
 * This middleware is included in {@link mdw.api}.
 *
 * @typeParam Ctx - The API context type.
 * @param schema - Object containing the `cache` table slice.
 * @returns A caching middleware function.
 *
 * @see {@link useCache} for React hook that reads cached data.
 *
 * @example Enable caching for an endpoint
 * ```ts
 * // Method 1: Using api.cache() helper
 * const fetchUsers = api.get('/users', api.cache());
 *
 * // Method 2: Manually enable in middleware
 * const fetchUsers = api.get('/users', function* (ctx, next) {
 *   ctx.cache = true;
 *   yield* next();
 * });
 * ```
 */
export function cache<Ctx extends ApiCtx = ApiCtx>(schema: {
  cache: TableOutput;
}) {
  return function* cache(ctx: Ctx, next: Next) {
    ctx.cacheData = yield* select(schema.cache.selectById, { id: ctx.key });
    yield* next();
    if (!ctx.cache) return;
    // biome-ignore lint/suspicious/noExplicitAny: generically add the return to cache
    let data: any;
    if (ctx.json.ok) {
      data = ctx.json.value;
    } else {
      data = ctx.json.error;
    }
    yield* updateStore(schema.cache.add({ [ctx.key]: data }));
    ctx.cacheData = data;
  };
}

/**
 * Track thunk execution status with loaders.
 *
 * @remarks
 * Automatically updates loader state for the thunk:
 * - Sets `loading` status when the thunk starts
 * - Sets `success` status when it completes normally
 * - Sets `error` status with message if it throws
 *
 * Loaders are tracked by both `ctx.name` (the thunk name) and `ctx.key`
 * (the unique action key including payload hash).
 *
 * Use this middleware for thunks that don't make HTTP requests but still
 * need loading state tracking. For API endpoints, use {@link mdw.loaderApi}
 * instead (included in {@link mdw.api}).
 *
 * @typeParam M - The loader metadata type.
 * @param schema - Object containing the `loaders` slice.
 * @returns A loader tracking middleware function.
 *
 * @example
 * ```ts
 * const thunks = createThunks();
 * thunks.use(mdw.loader({ loaders: schema.loaders }));
 * thunks.use(thunks.routes());
 *
 * const processData = thunks.create('process', function* (ctx, next) {
 *   // Loader automatically set to 'loading'
 *   yield* doExpensiveWork();
 *   yield* next();
 *   // Loader automatically set to 'success'
 * });
 * ```
 */
export function loader(schema: { loaders: LoaderOutput }) {
  return function* <Ctx extends ThunkCtxWLoader = ThunkCtxWLoader>(
    ctx: Ctx,
    next: Next,
  ) {
    yield* updateStore([
      schema.loaders.start({ id: ctx.name }),
      schema.loaders.start({ id: ctx.key }),
    ]);

    if (!ctx.loader) ctx.loader = {};

    try {
      yield* next();

      if (!ctx.loader) {
        ctx.loader = {};
      }

      yield* updateStore([
        schema.loaders.success({ id: ctx.name, ...ctx.loader }),
        schema.loaders.success({ id: ctx.key, ...ctx.loader }),
      ]);
    } catch (err) {
      if (!ctx.loader) {
        ctx.loader = {};
      }

      const message = isErrorLike(err) ? err.message : "unknown exception";
      yield* updateStore([
        schema.loaders.error({
          id: ctx.name,
          message,
          ...ctx.loader,
        }),
        schema.loaders.error({
          id: ctx.key,
          message,
          ...ctx.loader,
        }),
      ]);
    } finally {
      const loaders = yield* select(
        (s: Parameters<typeof schema.loaders.selectByIds>[0]) =>
          schema.loaders.selectByIds(s, { ids: [ctx.name, ctx.key] }),
      );
      const ids = loaders
        .filter((loader) => loader.status === "loading")
        .map((loader) => loader.id);

      if (ids.length > 0) {
        yield* updateStore(schema.loaders.resetByIds(ids));
      }
    }
  };
}

function defaultErrorFn<Ctx extends ApiCtx = ApiCtx>(ctx: Ctx) {
  const jso = ctx.json;
  if (jso.ok) return "";
  return jso.error?.message || "";
}

/**
 * Track API request status with loaders.
 *
 * @remarks
 * Similar to {@link mdw.loader} but designed for API endpoints. Uses
 * `ctx.response.ok` to determine success/error status instead of
 * try/catch alone.
 *
 * Status transitions:
 * - `loading` when request starts
 * - `success` when `ctx.response.ok` is true
 * - `error` when `ctx.response.ok` is false or an exception occurs
 * - Reset to previous state if no response is set
 *
 * You can customize the error message extraction by providing an `errorFn`.
 *
 * This middleware is included in {@link mdw.api}.
 *
 * @typeParam Ctx - The API context type.
 * @typeParam S - The store state type.
 * @param props - Configuration options.
 * @param props.schema - Object containing the `loaders` slice.
 * @param props.errorFn - Custom function to extract error message from context.
 * @returns A loader tracking middleware function.
 */
export function loaderApi<Ctx extends ApiCtx = ApiCtx>({
  schema,
  errorFn = defaultErrorFn,
}: ApiMdwProps<Ctx>) {
  return function* trackLoading(ctx: Ctx, next: Next) {
    try {
      yield* updateStore([
        schema.loaders.start({ id: ctx.name }),
        schema.loaders.start({ id: ctx.key }),
      ]);
      if (!ctx.loader) ctx.loader = {};

      yield* next();

      if (!ctx.response) {
        yield* updateStore(schema.loaders.resetByIds([ctx.name, ctx.key]));
        return;
      }

      if (!ctx.loader) {
        ctx.loader = {};
      }

      if (!ctx.response.ok) {
        yield* updateStore([
          schema.loaders.error({
            id: ctx.name,
            message: errorFn(ctx),
            ...ctx.loader,
          }),
          schema.loaders.error({
            id: ctx.key,
            message: errorFn(ctx),
            ...ctx.loader,
          }),
        ]);
        return;
      }

      yield* updateStore([
        schema.loaders.success({ id: ctx.name, ...ctx.loader }),
        schema.loaders.success({ id: ctx.key, ...ctx.loader }),
      ]);
    } catch (err) {
      const message = isErrorLike(err) ? err.message : "unknown exception";
      yield* updateStore([
        schema.loaders.error({
          id: ctx.name,
          message,
          ...ctx.loader,
        }),
        schema.loaders.error({
          id: ctx.key,
          message,
          ...ctx.loader,
        }),
      ]);
    } finally {
      const loaders = yield* select(
        (s: Parameters<typeof schema.loaders.selectByIds>[0]) =>
          schema.loaders.selectByIds(s, { ids: [ctx.name, ctx.key] }),
      );
      const ids = loaders
        .filter((loader) => loader.status === "loading")
        .map((loader) => loader.id);
      yield* updateStore(schema.loaders.resetByIds(ids));
    }
  };
}
