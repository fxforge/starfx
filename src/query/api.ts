import type { Next } from "../types.js";
import type { ApiName, QueryApi } from "./api-types.js";
import { createThunks } from "./thunk.js";
import type { ThunksApi } from "./thunk.js";
import type { ApiCtx, ApiRequest } from "./types.js";

/**
 * Creates a middleware pipeline for HTTP requests.
 *
 * @remarks
 * An API is a specialized thunk system designed to manage HTTP requests. It provides:
 * - HTTP method helpers (`.get()`, `.post()`, `.put()`, `.patch()`, `.delete()`, etc.)
 * - A router that maps action names to URL patterns
 * - Automatic request/response handling via middleware
 * - Built-in caching support with `api.cache()`
 *
 * The action name becomes the URL pattern, with support for URL parameters
 * (e.g., `/users/:id`). Empty parameters cause the request to bail early.
 *
 * Uses {@link createThunks} under the hood.
 *
 * @typeParam Ctx - The context type extending {@link ApiCtx}.
 * @param baseThunk - Optional base thunks instance to extend.
 * @returns A {@link QueryApi} with HTTP method helpers and middleware registration.
 *
 * @see {@link createThunks} for the underlying thunk system.
 * @see {@link mdw.api} for the recommended middleware stack.
 * @see {@link mdw.fetch} for the fetch implementation.
 *
 * @example Basic setup
 * ```ts
 * import { createApi, createStore, mdw } from 'starfx';
 * import { schema, initialState } from './schema';
 *
 * const api = createApi();
 * api.use(mdw.api({ schema }));
 * api.use(api.routes());
 * api.use(mdw.fetch({ baseUrl: 'https://api.example.com' }));
 *
 * // GET request with automatic caching
 * export const fetchUsers = api.get('/users', api.cache());
 *
 * // POST request with payload
 * export const createUser = api.post<{ name: string }>(
 *   '/users',
 *   function* (ctx, next) {
 *     ctx.request = ctx.req({
 *       body: JSON.stringify({ name: ctx.payload.name }),
 *     });
 *     yield* next();
 *   }
 * );
 *
 * const store = createStore({ initialState });
 * store.run(api.register);
 *
 * store.dispatch(fetchUsers());
 * store.dispatch(createUser({ name: 'Alice' }));
 * ```
 *
 * @example URL parameters
 * ```ts
 * // Parameters are extracted from payload
 * const fetchUser = api.get<{ id: string }>('/users/:id');
 * store.dispatch(fetchUser({ id: '123' }));
 * // Makes GET request to /users/123
 * ```
 *
 * @example Response typing
 * ```ts
 * interface User { id: string; name: string; }
 * interface ApiError { message: string; }
 *
 * const fetchUsers = api.get<never, User[], ApiError>(
 *   '/users',
 *   function* (ctx, next) {
 *     yield* next();
 *     if (ctx.json.ok) {
 *       // ctx.json.value is User[]
 *       console.log(ctx.json.value);
 *     } else {
 *       // ctx.json.error is ApiError
 *       console.error(ctx.json.error.message);
 *     }
 *   }
 * );
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
