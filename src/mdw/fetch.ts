import { sleep, until } from "effection";
import { safe } from "../fx/index.js";
import type { FetchCtx, FetchJsonCtx } from "../query/index.js";
import { isObject, noop } from "../query/util.js";
import type { Next } from "../types.js";

/**
 * This middleware converts the name provided to {@link createApi}
 * into `url` and `method` for the fetch request.
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
 * Automatically sets `content-type` to `application/json` when
 * that header is not already present.
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
 * This middleware takes the `ctx.response` and sets `ctx.json` to the body representation
 * requested.  It uses the `ctx.bodyType` property to determine how to represent the body.
 * The default is set to `json` which calls `Response.json()`.
 *
 * @example
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
 * If there's a slug inside the ctx.name (which is the URL segement in this case)
 * and there is *not* a corresponding truthy value in the payload, then that means
 * the user has an empty value (e.g. empty string) which means we want to abort the
 * fetch request.
 *
 * e.g. `ctx.name = "/apps/:id"` with `payload = { id: '' }`
 *
 * Ideally the action wouldn't have been dispatched at all but that is *not* a
 * gaurantee we can make here.
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
