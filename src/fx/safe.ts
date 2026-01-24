import type { Operation, Result } from "effection";
import { Err, Ok, call } from "effection";

/**
 * Wrap an operation to prevent it from throwing exceptions.
 *
 * @remarks
 * The `safe` function ensures that operations never raise uncaught exceptions.
 * Instead, any errors are captured and returned as an `Err` result, while
 * successful values are wrapped in an `Ok` result.
 *
 * This is essential for building robust async flows where you want to handle
 * errors explicitly rather than relying on try/catch blocks.
 *
 * @typeParam T - The success value type.
 * @typeParam TArgs - Argument types for the operation.
 * @param operator - Operation factory to wrap.
 * @returns An operation yielding a {@link Result} containing either the value or error.
 *
 * @see {@link parallel} which uses `safe` internally.
 * @see {@link Result}, {@link Ok}, {@link Err} from Effection.
 *
 * @example Basic usage
 * ```ts
 * import { safe } from 'starfx';
 *
 * function* run() {
 *   const result = yield* safe(() => fetch('https://api.example.com/users'));
 *
 *   if (result.ok) {
 *     console.log('Response:', result.value);
 *   } else {
 *     console.error('Failed:', result.error.message);
 *   }
 * }
 * ```
 *
 * @example With async operations
 * ```ts
 * function* fetchUser(id: string) {
 *   const result = yield* safe(function* () {
 *     const response = yield* until(fetch(`/users/${id}`));
 *     if (!response.ok) throw new Error('Not found');
 *     return yield* until(response.json());
 *   });
 *
 *   return result; // Result<User>
 * }
 * ```
 *
 * @example Chaining with Result
 * ```ts
 * function* pipeline() {
 *   const userResult = yield* safe(() => fetchUser('123'));
 *   if (!userResult.ok) return userResult;
 *
 *   const postsResult = yield* safe(() => fetchPosts(userResult.value.id));
 *   return postsResult;
 * }
 * ```
 */
function isError(error: unknown): error is Error {
  return error instanceof Error;
}

export function* safe<T, TArgs extends unknown[] = []>(
  operator: (...args: TArgs) => Operation<T>,
): Operation<Result<T>> {
  try {
    const value = yield* call(operator);
    return Ok(value);
  } catch (error) {
    return Err(isError(error) ? error : new Error(String(error)));
  }
}
