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
 * This middleware is a composition of many middleware used to faciliate
 * the {@link createApi}.
 *
 * It is not required, however, it is battle-tested and highly recommended.
 *
 * List of mdw:
 *  - {@link mdw.err}
 *  - {@link mdw.actions}
 *  - {@link mdw.queryCtx}
 *  - {@link mdw.customKey}
 *  - {@link mdw.nameParser}
 *  - {@link mdw.loaderApi}
 *  - {@link mdw.cache}
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
 * This middleware will automatically cache any data found inside `ctx.json`
 * which is where we store JSON data from the {@link mdw.fetch} middleware.
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
 * This middleware will track the status of a middleware fn
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
 * This middleware will track the status of a fetch request.
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
