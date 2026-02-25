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
 * @remarks
 * This middleware system is similar to Koa's middleware pattern. Each middleware
 * receives a context object and a `next` function. Calling `yield* next()` passes
 * control to the next middleware in the stack. Code after `yield* next()` runs
 * after all downstream middleware have completed.
 *
 * If a middleware does not call `next()`, the remaining middleware are skipped,
 * providing "exit early" functionality.
 *
 * @typeParam Ctx - The context type passed through the middleware stack.
 * @typeParam T - The return type of middleware functions.
 * @param middleware - Array of middleware functions to compose.
 * @returns A composed middleware function that executes the stack in order.
 * @throws {TypeError} If `middleware` is not an array or contains non-functions.
 *
 * @see {@link https://koajs.com | Koa.js} for the inspiration behind this pattern.
 *
 * @example
 * ```ts
 * import { compose } from 'starfx';
 *
 * const mdw = compose([
 *   function* first(ctx, next) {
 *     console.log('1 - before');
 *     yield* next();
 *     console.log('1 - after');
 *   },
 *   function* second(ctx, next) {
 *     console.log('2 - before');
 *     yield* next();
 *     console.log('2 - after');
 *   },
 * ]);
 *
 * // Output: 1 - before, 2 - before, 2 - after, 1 - after
 * ```
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
