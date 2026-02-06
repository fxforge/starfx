import { type Operation, type Task, call, race, sleep, spawn } from "effection";
import { createAction, take } from "./action.js";
import { getIdFromAction } from "./action.js";
import type { CreateActionPayload } from "./query/index.js";
import type { ActionWithPayload, AnyAction } from "./types.js";

const MS = 1000;
const SECONDS = 1 * MS;
const MINUTES = 60 * SECONDS;

/**
 * Create a polling supervisor for periodic execution.
 *
 * @remarks
 * When activated, calls the thunk or endpoint once, then repeats every
 * `parentTimer` milliseconds until a cancellation action is dispatched.
 *
 * The timer can be overridden per-dispatch by including `timer` in the payload.
 * Polling is cancelled when an action with the same type is dispatched again,
 * or when an optional `cancelType` action is dispatched.
 *
 * @param parentTimer - Default interval between executions (default: 5 seconds).
 * @param cancelType - Optional action type that cancels polling.
 * @returns A supervisor function.
 *
 * @see {@link timer} for request throttling.
 *
 * @example Basic polling
 * ```ts
 * const fetchUsers = api.get('/users', {
 *   supervisor: poll(10 * 1000), // Poll every 10 seconds
 * });
 *
 * // Start polling
 * dispatch(fetchUsers());
 * // fetch -> wait 10s -> fetch -> wait 10s -> ...
 *
 * // Stop polling (dispatching same action cancels previous)
 * dispatch(fetchUsers());
 * ```
 *
 * @example Custom timer per call
 * ```ts
 * const fetchStatus = api.get('/status', {
 *   supervisor: poll(),
 * });
 *
 * // Override timer for this specific call
 * dispatch(fetchStatus({ timer: 30000 })); // Poll every 30 seconds
 * ```
 */
export function poll(parentTimer: number = 5 * SECONDS, cancelType?: string) {
  return function* poller<T>(
    actionType: string,
    op: (action: AnyAction) => Operation<T>,
  ): Operation<T> {
    const cancel = cancelType || actionType;
    function* fire(action: { type: string }, timer: number) {
      while (true) {
        yield* op(action);
        yield* sleep(timer);
      }
    }

    while (true) {
      const action = yield* take<{ timer?: number }>(actionType);
      const timer = action.payload?.timer || parentTimer;
      yield* race([fire(action, timer), take(`${cancel}`) as Operation<void>]);
    }
  };
}

type ClearTimerPayload = string | { type: string; payload: { key: string } };

export const clearTimers = createAction<
  ClearTimerPayload | ClearTimerPayload[]
>("clear-timers");

/**
 * Create a cache timer supervisor for API endpoints.
 *
 * @remarks
 * The timer supervisor ensures that repeated calls to the same endpoint
 * (with the same payload) are throttled. Once an endpoint is called, subsequent
 * calls with the same `key` (hash of name + payload) are ignored until the
 * timer expires.
 *
 * This is particularly useful for preventing duplicate API requests when:
 * - Users rapidly click buttons
 * - Components re-mount and re-fetch
 * - Multiple components request the same data
 *
 * The `key` is a hash of the action type AND payload, so:
 * - `fetchUser({ id: '1' })` and `fetchUser({ id: '2' })` have different timers
 * - Only `fetchUser({ id: '1' })` calls within the timer window are throttled
 *
 * Use {@link clearTimers} to manually invalidate timers.
 *
 * @param timer - Cache duration in milliseconds (default: 5 minutes).
 * @returns A supervisor function.
 *
 * @see {@link clearTimers} for manual cache invalidation.
 * @see {@link poll} for periodic fetching.
 *
 * @example Basic usage
 * ```ts
 * const fetchUser = api.get('/users/:id', {
 *   supervisor: timer(60 * 1000), // 1 minute cache
 * });
 *
 * dispatch(fetchUser({ id: '1' })); // Makes request
 * dispatch(fetchUser({ id: '1' })); // Ignored (within timer)
 * dispatch(fetchUser({ id: '2' })); // Makes request (different key)
 * // After 1 minute...
 * dispatch(fetchUser({ id: '1' })); // Makes request again
 * ```
 *
 * @example Clear timer manually
 * ```ts
 * import { clearTimers } from 'starfx';
 *
 * // Clear specific endpoint
 * dispatch(clearTimers(fetchUser({ id: '1' })));
 *
 * // Clear all timers
 * dispatch(clearTimers('*'));
 * ```
 */
export function timer(timer: number = 5 * MINUTES) {
  return function* onTimer(
    actionType: string,
    op: (action: AnyAction) => Operation<unknown>,
  ) {
    const map: { [key: string]: Task<unknown> } = {};

    function* activate(action: ActionWithPayload<CreateActionPayload>) {
      yield* call(() => op(action));
      const idA = getIdFromAction(action);

      const matchFn = (
        act: ActionWithPayload<ClearTimerPayload | ClearTimerPayload[]>,
      ) => {
        if (act.type !== `${clearTimers}`) return false;
        if (!act.payload) return false;
        const ids = Array.isArray(act.payload) ? act.payload : [act.payload];
        return ids.some((id) => {
          if (id === "*") {
            return true;
          }
          if (typeof id === "string") {
            return idA === id;
          }
          return idA === getIdFromAction(id);
        });
      };
      yield* race([sleep(timer), take(matchFn as any) as Operation<void>]);

      delete map[action.payload.key];
    }

    while (true) {
      const action = yield* take<CreateActionPayload>(`${actionType}`);
      const key = action.payload.key;
      if (!map[key]) {
        const task = yield* spawn(function* () {
          yield* activate(action);
        });
        map[key] = task;
      }
    }
  };
}
