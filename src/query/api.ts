import type { Next } from "../types.js";
import type { ApiName, QueryApi } from "./api-types.js";
import { createThunks } from "./thunk.js";
import type { ThunksApi } from "./thunk.js";
import type { ApiCtx, ApiRequest } from "./types.js";

/**
 * Creates a middleware thunksline for HTTP requests.
 *
 * @remarks
 * It uses {@link createThunks} under the hood.
 *
 * @example
 * ```ts
 * import { createApi, mdw } from 'starfx';
 *
 * const api = createApi();
 * api.use(mdw.api());
 * api.use(api.routes());
 * api.use(mdw.fetch({ baseUrl: 'https://api.com' }));
 *
 * const fetchUsers = api.get('/users', function*(ctx, next) {
 *   yield next();
 * });
 *
 * store.dispatch(fetchUsers());
 * ```
 */
export function createApi<Ctx extends ApiCtx = ApiCtx>(
  baseThunk?: ThunksApi<Ctx>,
): QueryApi<Ctx> {
  const thunks = baseThunk || createThunks<Ctx>();
  const uri = (prename: ApiName) => {
    const create = thunks.create as any;

    let name = prename;
    let remainder = "";
    if (Array.isArray(name)) {
      if (name.length === 0) {
        throw new Error(
          "createApi requires a non-empty array for the name of the endpoint",
        );
      }
      name = prename[0];
      if (name.length > 1) {
        const [_, ...other] = prename;
        remainder = ` ${other.join("|")}`;
      }
    }
    const tmpl = (method: string) => `${name} [${method}]${remainder}`;

    return {
      get: (...args: any[]) => create(tmpl("GET"), ...args),
      post: (...args: any[]) => create(tmpl("POST"), ...args),
      put: (...args: any[]) => create(tmpl("PUT"), ...args),
      patch: (...args: any[]) => create(tmpl("PATCH"), ...args),
      delete: (...args: any[]) => create(tmpl("DELETE"), ...args),
      options: (...args: any[]) => create(tmpl("OPTIONS"), ...args),
      head: (...args: any[]) => create(tmpl("HEAD"), ...args),
      connect: (...args: any[]) => create(tmpl("CONNECT"), ...args),
      trace: (...args: any[]) => create(tmpl("TRACE"), ...args),
    };
  };

  return {
    use: thunks.use,
    register: thunks.register,
    create: thunks.create,
    manage: thunks.manage,
    routes: thunks.routes,
    reset: thunks.reset,
    cache: () => {
      return function* onCache(ctx: Ctx, next: Next) {
        ctx.cache = true;
        yield* next();
      };
    },
    request: (req: ApiRequest) => {
      return function* onRequest(ctx: Ctx, next: Next) {
        ctx.request = ctx.req(req);
        yield* next();
      };
    },
    uri,
    get: (name: ApiName, ...args: any[]) => uri(name).get(...args),
    post: (name: ApiName, ...args: any[]) => uri(name).post(...args),
    put: (name: ApiName, ...args: any[]) => uri(name).put(...args),
    patch: (name: ApiName, ...args: any[]) => uri(name).patch(...args),
    delete: (name: ApiName, ...args: any[]) => uri(name).delete(...args),
    options: (name: ApiName, ...args: any[]) => uri(name).options(...args),
    head: (name: ApiName, ...args: any[]) => uri(name).head(...args),
    connect: (name: ApiName, ...args: any[]) => uri(name).connect(...args),
    trace: (name: ApiName, ...args: any[]) => uri(name).trace(...args),
  };
}
