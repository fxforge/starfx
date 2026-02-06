import { sleep, until } from "effection";
import { safe } from "../fx/index.js";
import type { FetchCtx, FetchJsonCtx } from "../query/index.js";
import { isObject, noop } from "../query/util.js";
import type { Next } from "../types.js";

/**
 * Parse URL and HTTP method from the action name.
 *
 * @remarks
 * This middleware extracts the URL pattern and HTTP method from the action name
 * provided to {@link createApi}. The format is: `/path [METHOD]`
 *
 * It also performs URL parameter substitution, replacing `:param` placeholders
 * with values from `ctx.payload`.
 *
 * Supported HTTP methods: GET, HEAD, POST, PUT, DELETE, CONNECT, OPTIONS, TRACE, PATCH
 *
 * This middleware is included in {@link mdw.api}.
 *
 * @typeParam Ctx - The fetch context type.
 *
 * @example How names are parsed
 * ```ts
 * // Name: '/users [GET]' -> url: '/users', method: 'GET'
 * const fetchUsers = api.get('/users');
 *
 * // Name: '/users/:id [GET]' with payload { id: '123' }
 * // -> url: '/users/123', method: 'GET'
 * const fetchUser = api.get<{ id: string }>('/users/:id');
 * ```
 */
export function* nameParser<Ctx extends FetchJsonCtx = FetchJsonCtx>(
  ctx: Ctx,
  next: Next,
) {
  const httpMethods = [
    "get",
    "head",
    "post",
    "put",
    "delete",
    "connect",
    "options",
    "trace",
    "patch",
  ];

  const options = ctx.payload || {};
  if (!isObject(options)) {
    yield* next();
    return;
  }

  let url = Object.keys(options).reduce((acc, key) => {
    return acc.replace(`:${key}`, options[key]);
  }, ctx.name);

  let method = "";
  httpMethods.forEach((curMethod) => {
    const pattern = new RegExp(`\\s*\\[${curMethod}\\]\\s*\\w*`, "i");
    const tmpUrl = url.replace(pattern, "");
    if (tmpUrl.length !== url.length) {
      method = curMethod.toLocaleUpperCase();
    }
    url = tmpUrl;
  }, url);

  if (ctx.req().url === "") {
    ctx.request = ctx.req({ url });
  }

  if (method) {
    ctx.request = ctx.req({ method });
  }

  yield* next();
}

/**
 * Set default Content-Type header to application/json.
 *
 * @remarks
 * If `ctx.request` exists and doesn't have a `Content-Type` header set,
 * this middleware adds `Content-Type: application/json`.
 *
 * This is useful as a default for JSON APIs but can be overridden by
 * setting the header explicitly in your endpoint middleware.
 *
 * @typeParam CurCtx - The fetch context type.
 *
 * @example Override the default
 * ```ts
 * const uploadFile = api.post('/upload', function* (ctx, next) {
 *   ctx.request = ctx.req({
 *     headers: { 'Content-Type': 'multipart/form-data' },
 *   });
 *   yield* next();
 * });
 * ```
 */
export function* headers<CurCtx extends FetchCtx = FetchCtx>(
  ctx: CurCtx,
  next: Next,
) {
  if (!ctx.request) {
    yield* next();
    return;
  }

  const cur = ctx.req();
  if (!(cur as any).headers["Content-Type"]) {
    ctx.request = ctx.req({
      headers: { "Content-Type": "application/json" },
    });
  }

  yield* next();
}

/**
 * Parse the fetch response body and set `ctx.json`.
 *
 * @remarks
 * Takes `ctx.response` and parses its body according to `ctx.bodyType`
 * (default: 'json'). The result is stored in `ctx.json` as a {@link Result}:
 * - `{ ok: true, value: data }` if response is OK and parsing succeeds
 * - `{ ok: false, error: data }` if response is not OK
 * - `{ ok: false, error: { message } }` if parsing fails
 *
 * Special case: HTTP 204 (No Content) returns an empty object.
 *
 * Change `ctx.bodyType` to use different Response methods:
 * - 'json' -> `Response.json()`
 * - 'text' -> `Response.text()`
 * - 'blob' -> `Response.blob()`
 * - etc.
 *
 * This middleware is part of {@link mdw.fetch}.
 *
 * @typeParam CurCtx - The fetch context type.
 *
 * @example Change body type
 * ```ts
 * const fetchUsers = api.get('/users', function*(ctx, next) {
 *  ctx.bodyType = 'text'; // calls Response.text();
 *  yield next();
 * })
 * ```
 */
export function* json<CurCtx extends FetchJsonCtx = FetchJsonCtx>(
  ctx: CurCtx,
  next: Next,
) {
  if (!ctx.response) {
    yield* next();
    return;
  }

  if (ctx.response.status === 204) {
    ctx.json = {
      ok: true,
      value: {},
    };
    yield* next();
    return;
  }

  const data = yield* safe(() => {
    const resp = ctx.response;
    if (!resp) throw new Error("response is falsy");
    return until(resp[ctx.bodyType]());
  });

  if (data.ok) {
    if (ctx.response.ok) {
      ctx.json = {
        ok: true,
        value: data.value,
      };
    } else {
      ctx.json = {
        ok: false,
        error: data.value,
      };
    }
  } else {
    const dta = { message: data.error.message };
    ctx.json = {
      ok: false,
      error: dta,
    };
  }

  yield* next();
}

/*
 * This middleware takes the `baseUrl` provided to {@link mdw.fetch} and combines it
 * with the url from `ctx.request.url`.
 */
export function composeUrl<CurCtx extends FetchJsonCtx = FetchJsonCtx>(
  baseUrl = "",
) {
  return function* (ctx: CurCtx, next: Next) {
    const req = ctx.req();
    ctx.request = ctx.req({ url: `${baseUrl}${req.url}` });
    yield* next();
  };
}

/**
 * Validate URL parameters against payload values.
 *
 * @remarks
 * Checks if the URL pattern contains parameter placeholders (`:param`) and
 * validates that corresponding payload values are truthy. If a required
 * parameter has a falsy value (empty string, null, undefined), the request
 * is aborted early with an error in `ctx.json`.
 *
 * This prevents accidental requests to URLs like `/users/undefined` when
 * required data isn't available yet.
 *
 * This middleware is part of {@link mdw.fetch}.
 *
 * @typeParam CurCtx - The fetch context type.
 *
 * @example Automatic validation
 * ```ts
 * const fetchUser = api.get<{ id: string }>('/users/:id');
 *
 * // This works
 * dispatch(fetchUser({ id: '123' }));
 *
 * // This bails early with error (no network request)
 * dispatch(fetchUser({ id: '' }));
 * // ctx.json = { ok: false, error: 'found :id in endpoint name...' }
 * ```
 */
export function* payload<CurCtx extends FetchJsonCtx = FetchJsonCtx>(
  ctx: CurCtx,
  next: Next,
) {
  const payload = ctx.payload;
  if (!payload) {
    yield* next();
    return;
  }

  const keys = Object.keys(payload);
  for (let i = 0; i < keys.length; i += 1) {
    const key = keys[i];
    if (!ctx.name.includes(`:${key}`)) {
      continue;
    }

    const val = payload[key];
    if (!val) {
      const data = `found :${key} in endpoint name (${ctx.name}) but payload has falsy value (${val})`;
      ctx.json = {
        ok: false,
        error: data,
      };
      return;
    }
  }

  yield* next();
}

/*
 * This middleware simply checks if `ctx.response` already contains a
 * truthy value, and if it does, bail out of the middleware stack.
 */
export function response<CurCtx extends FetchCtx = FetchCtx>(
  response?: Response,
) {
  return function* responseMdw(ctx: CurCtx, next: Next) {
    if (response) {
      ctx.response = response;
    }
    yield* next();
  };
}

/*
 * This middleware makes the `fetch` http request using `ctx.request` and
 * assigns the response to `ctx.response`.
 */
export function* request<CurCtx extends FetchCtx = FetchCtx>(
  ctx: CurCtx,
  next: Next,
) {
  // if there is already a response then we want to bail so we don't
  // override it.
  if (ctx.response) {
    yield* next();
    return;
  }

  const { url, ...req } = ctx.req();
  const request = new Request(url, req);
  const result = yield* safe(() => until(fetch(request)));
  if (result.ok) {
    ctx.response = result.value;
  } else {
    throw result.error;
  }
  yield* next();
}

function backoffExp(attempt: number): number {
  if (attempt > 5) return -1;
  // 1s, 1s, 1s, 2s, 4s
  return Math.max(2 ** attempt * 125, 1000);
}

/**
 * This middleware will retry failed `Fetch` request if `response.ok` is `false`.
 * It accepts a backoff function to determine how long to continue retrying.
 * The default is an exponential backoff {@link backoffExp} where the minimum is
 * 1sec between attempts and it'll reach 4s between attempts at the end with a
 * max of 5 attempts.
 *
 * An example backoff:
 * @example
 * ```ts
 *  // Any value less than 0 will stop the retry middleware.
 *  // Each attempt will wait 1s
 *  const backoff = (attempt: number) => {
 *    if (attempt > 5) return -1;
 *    return 1000;
 *  }
 *
 * const api = createApi();
 * api.use(mdw.api());
 * api.use(api.routes());
 * api.use(mdw.fetch());
 *
 * const fetchUsers = api.get('/users', [
 *  function*(ctx, next) {
 *    // ...
 *    yield next();
 *  },
 *  // fetchRetry should be after your endpoint function because
 *  // the retry middleware will update `ctx.json` before it reaches
 *  // your middleware
 *  fetchRetry(backoff),
 * ])
 * ```
 */
export function fetchRetry<CurCtx extends FetchJsonCtx = FetchJsonCtx>(
  backoff: (attempt: number) => number = backoffExp,
) {
  return function* (ctx: CurCtx, next: Next) {
    yield* next();

    if (!ctx.response) {
      return;
    }

    if (ctx.response.ok) {
      return;
    }

    let attempt = 1;
    let waitFor = backoff(attempt);
    while (waitFor >= 1) {
      yield* sleep(waitFor);
      // reset response so `request` mdw actually runs
      ctx.response = null;
      yield* safe(() => request(ctx, noop));
      yield* safe(() => json(ctx, noop));

      if (ctx.response && (ctx.response as Response).ok) {
        return;
      }

      attempt += 1;
      waitFor = backoff(attempt);
    }
  };
}
