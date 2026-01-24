import type { Operation } from "effection";
import type { Next } from "./types.js";

/**
 * Base context for middleware. Implementations may extend this with typed fields.
 */
export interface BaseCtx {
  [key: string]: any;
}

/**
 * Middleware function shape used across the library.
 */
export type BaseMiddleware<Ctx extends BaseCtx = BaseCtx, T = unknown> = (
  ctx: Ctx,
  next: Next,
) => Operation<T | undefined>;

/**
 * Compose an array of middleware into a single middleware function.
 *
 * @param middleware - Array of middleware to compose.
 * @returns A composed middleware function that runs the stack in order.
 */
export function compose<Ctx extends BaseCtx = BaseCtx, T = unknown>(
  middleware: BaseMiddleware<Ctx, T>[],
) {
  if (!Array.isArray(middleware)) {
    throw new TypeError("Middleware stack must be an array!");
  }

  for (const fn of middleware) {
    if (typeof fn !== "function") {
      throw new TypeError("Middleware must be composed of functions!");
    }
  }

  return function* composeFn(context: Ctx, mdw?: BaseMiddleware<Ctx, T>) {
    // last called middleware #
    let index = -1;

    function* dispatch(i: number): Operation<void> {
      if (i <= index) {
        throw new Error("next() called multiple times");
      }
      index = i;
      let fn: BaseMiddleware<Ctx, T> | undefined = middleware[i];
      if (i === middleware.length) {
        fn = mdw;
      }
      if (!fn) {
        return;
      }
      const nxt = dispatch.bind(null, i + 1);
      yield* fn(context, nxt);
    }

    yield* dispatch(0);
  };
}
