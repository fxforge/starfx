import {
  type Context,
  Ok,
  type Operation,
  type Scope,
  createContext,
  each,
  ensure,
  suspend,
  useScope,
} from "effection";
import { API_ACTION_PREFIX, takeEvery } from "../action.js";
import { compose } from "../compose.js";
import { supervise } from "../fx/index.js";
import { createKey } from "./create-key.js";
import { isFn, isObject } from "./util.js";

import { createReplaySignal } from "../fx/replay-signal.js";
import { IdContext } from "../store/store.js";
import type { ActionWithPayload, AnyAction, Next, Payload } from "../types.js";
import type {
  CreateAction,
  CreateActionPayload,
  CreateActionWithPayload,
  Middleware,
  MiddlewareCo,
  Supervisor,
  ThunkCtx,
} from "./types.js";

/**
 * API for creating and managing thunk-style actions.
 *
 * @remarks
 * Use {@link createThunks} (or {@link createApi}) to obtain an instance of this API.
 * The ThunksApi provides:
 * - `use()` for registering middleware
 * - `create()` for creating typed action creators with associated handlers
 * - `routes()` for the middleware router
 * - `register()` for connecting to the store
 * - `manage()` for handling and exposing Effection resources
 *
 * Each created thunk is an action creator that can be dispatched to trigger
 * its middleware handler.
 *
 * @typeParam Ctx - The context type extending {@link ThunkCtx}.
 *
 * @see {@link createThunks} for creating a ThunksApi instance.
 * @see {@link createApi} for HTTP-specific thunks.
 */
export interface ThunksApi<Ctx extends ThunkCtx> {
  /** Register a middleware function into the pipeline. */
  use: (fn: Middleware<Ctx>) => void;
  /** Returns a middleware function that routes to action-specific middleware. */
  routes: () => Middleware<Ctx>;
  /** Register the thunks with the current store scope. */
  register: () => Operation<void>;
  /** Reset any dynamically bound middleware for created actions. */
  reset: () => void;
  /**
   * Start and expose an Effection resource within the store scope.
   *
   * @param name - unique name for the resource Context
   * @param resource - an Effection Operation (usually created with `resource(...)`)
   * @returns a `Context<Resource>` that can `get()` or `expect()`
   */
  manage: <Resource>(
    name: string,
    resource: Operation<Resource>,
  ) => Context<Resource>;

  /**
   * Name only
   */
  create(name: string): CreateAction<Ctx>;
  create<P>(
    name: string,
  ): CreateActionWithPayload<Omit<Ctx, "payload"> & Payload<P>, P>;

  /**
   * Name and options
   */
  create(name: string, req: { supervisor?: Supervisor }): CreateAction<Ctx>;
  create<P>(
    name: string,
    req: { supervisor?: Supervisor },
  ): CreateActionWithPayload<Omit<Ctx, "payload"> & Payload<P>, P>;

  /**
   * Name and middleware
   */
  create(name: string, fn: MiddlewareCo<Ctx>): CreateAction<Ctx>;
  create<Gtx extends Ctx = Ctx>(
    name: string,
    fn: MiddlewareCo<Gtx>,
  ): CreateAction<Gtx>;
  create<P>(
    name: string,
    fn: MiddlewareCo<Omit<Ctx, "payload"> & Payload<P>>,
  ): CreateActionWithPayload<Omit<Ctx, "payload"> & Payload<P>, P>;
  create<P, Gtx extends Ctx = Ctx>(
    name: string,
    fn: MiddlewareCo<Gtx>,
  ): CreateActionWithPayload<Gtx, P>;

  /*
   * Name, options, and middleware
   */
  create(
    name: string,
    req: { supervisor?: Supervisor },
    fn: MiddlewareCo<Ctx>,
  ): CreateAction<Ctx>;
  create<Gtx extends Ctx = Ctx>(
    name: string,
    req: { supervisor?: Supervisor },
    fn: MiddlewareCo<Gtx>,
  ): CreateAction<Gtx>;
  create<P>(
    name: string,
    req: { supervisor?: Supervisor },
    fn: MiddlewareCo<Omit<Ctx, "payload"> & Payload<P>>,
  ): CreateActionWithPayload<Omit<Ctx, "payload"> & Payload<P>, P>;
  create<P, Gtx extends Ctx = Ctx>(
    name: string,
    req: { supervisor?: Supervisor },
    fn: MiddlewareCo<Gtx>,
  ): CreateActionWithPayload<Gtx, P>;
}
type Visors = (scope: Scope) => () => Operation<void>;

/**
 * Creates a middleware pipeline for thunks.
 *
 * @remarks
 * Thunks are the foundational processing units in starfx. They have access to all
 * dispatched actions, the global state, and the full power of structured concurrency.
 *
 * Think of thunks as micro-controllers that can:
 * - Update state (the only place where state mutations should occur)
 * - Coordinate async operations with Effection
 * - Call other thunks for composition
 *
 * The middleware system is similar to Koa/Express. Each middleware receives
 * a context (`ctx`) and a `next` function. Calling `yield* next()` passes
 * control to the next middleware. Not calling `next()` exits early.
 *
 * Every thunk requires a unique name/id which enables:
 * - Better traceability and debugging
 * - Naming convention abstractions (e.g., API routers)
 * - Deterministic action types
 *
 * @typeParam Ctx - The context type extending {@link ThunkCtx}.
 * @param options - Configuration options.
 * @param options.supervisor - Default supervisor strategy (default: `takeEvery`).
 * @returns A {@link ThunksApi} for creating and managing thunks.
 *
 * @see {@link https://koajs.com | Koa.js} for the middleware pattern inspiration.
 * @see {@link createApi} for HTTP-specific thunks.
 * @see {@link takeEvery}, {@link takeLatest}, {@link takeLeading} for supervisor strategies.
 *
 * @example Basic setup
 * ```ts
 * import { createThunks, mdw } from 'starfx';
 *
 * const thunks = createThunks();
 * // Catch and log errors
 * thunks.use(mdw.err);
 * // Route to action-specific middleware
 * thunks.use(thunks.routes());
 *
 * const log = thunks.create<string>('log', function* (ctx, next) {
 *   console.log('Message:', ctx.payload);
 *   yield* next();
 * });
 *
 * store.dispatch(log('Hello world'));
 * ```
 *
 * @example Middleware execution order
 * ```ts
 * const thunks = createThunks();
 *
 * thunks.use(function* (ctx, next) {
 *   console.log('1 - before');
 *   yield* next();
 *   console.log('4 - after');
 * });
 *
 * thunks.use(thunks.routes());
 *
 * const doit = thunks.create('doit', function* (ctx, next) {
 *   console.log('2 - handler before');
 *   yield* next();
 *   console.log('3 - handler after');
 * });
 *
 * store.dispatch(doit());
 * // Output: 1 - before, 2 - handler before, 3 - handler after, 4 - after
 * ```
 *
 * @example Custom supervisor
 * ```ts
 * import { takeLatest, takeLeading } from 'starfx';
 *
 * // Search with debounce-like behavior
 * const search = thunks.create('search', { supervisor: takeLatest });
 *
 * // Prevent duplicate submissions
 * const submitForm = thunks.create('submit', { supervisor: takeLeading });
 * ```
 *
 * @example Type-safe payload
 * ```ts
 * interface CreateUserPayload {
 *   name: string;
 *   email: string;
 * }
 *
 * const createUser = thunks.create<CreateUserPayload>(
 *   'create-user',
 *   function* (ctx, next) {
 *     // ctx.payload is typed as CreateUserPayload
 *     const { name, email } = ctx.payload;
 *     yield* next();
 *   }
 * );
 *
 * createUser({ name: 'Alice', email: 'alice@example.com' }); // OK
 * createUser({ name: 'Bob' }); // Type error: missing email
 * ```
 */
export function createThunks<Ctx extends ThunkCtx = ThunkCtx<any>>(
  {
    supervisor = takeEvery,
  }: {
    supervisor?: Supervisor;
  } = { supervisor: takeEvery },
): ThunksApi<Ctx> {
  const storeRegistration = new Set();
  const watch = createReplaySignal<Visors, void>();

  const middleware: Middleware<Ctx>[] = [];
  const middlewareMap: { [key: string]: Middleware<Ctx> } = {};
  let dynamicMiddlewareMap: { [key: string]: Middleware<Ctx> } = {};
  const actionMap: {
    [key: string]: CreateActionWithPayload<Ctx, any>;
  } = {};

  function* defaultMiddleware(_: Ctx, next: Next) {
    yield* next();
  }

  const createType = (post: string) => `${API_ACTION_PREFIX}${post}`;

  function* onApi<P extends CreateActionPayload>(
    action: ActionWithPayload<P> | AnyAction,
  ): Operation<Ctx> {
    const { name, key, options } = action.payload;
    const actionFn = actionMap[name];
    const ctx = {
      action,
      name,
      key,
      payload: options,
      actionFn,
      result: Ok(undefined),
    } as unknown as Ctx;
    const fn = compose(middleware);
    yield* fn(ctx);
    return ctx;
  }

  function create(name: string, ...args: any[]) {
    if (actionMap[name]) {
      const msg = `[${name}] already exists, do you have two thunks with the same name?`;
      console.warn(msg);
    }

    const type = createType(name);
    const action = (payload?: any) => {
      return { type, payload };
    };
    let req: { supervisor?: Supervisor } | null = null;
    let fn: MiddlewareCo<Ctx> | null = null;
    if (args.length === 2) {
      req = args[0];
      fn = args[1];
    }

    if (args.length === 1) {
      if (isFn(args[0]) || Array.isArray(args[0])) {
        fn = args[0];
      } else {
        req = args[0];
      }
    }

    if (req && !isObject(req)) {
      throw new Error("Options must be an object");
    }

    if (fn && Array.isArray(fn)) {
      fn = compose(fn);
    }

    if (fn && !isFn(fn)) {
      throw new Error("Middleware must be a function");
    }

    middlewareMap[name] = fn || defaultMiddleware;

    const tt = req?.supervisor ? req.supervisor : supervisor;
    function* curVisor(): Operation<void> {
      yield* tt(type, onApi);
    }
    watch.send(() => supervise(curVisor));

    const errMsg = `[${name}] is being called before its thunk has been registered. Run \`store.run(thunks.register)\` where \`thunks\` is the name of your \`createThunks\` or \`createApi\` variable.`;
    const actionFn = (options?: Ctx["payload"]) => {
      if (storeRegistration.size === 0) {
        console.warn(errMsg);
      }
      const key = createKey(name, options);
      return action({ name, key, options });
    };
    actionFn.run = (action?: unknown): Operation<Ctx> => {
      if (action && (action as any).type) {
        return onApi(action as ActionWithPayload<CreateActionPayload>);
      }
      return onApi(actionFn(action));
    };
    actionFn.use = (fn: Middleware<Ctx>) => {
      const cur = middlewareMap[name];
      if (cur) {
        dynamicMiddlewareMap[name] = compose([cur, fn]);
      } else {
        dynamicMiddlewareMap[name] = fn;
      }
    };
    actionFn.toString = () => type;
    actionFn._success = {};
    actionFn._error = {};
    actionMap[name] = actionFn;

    return actionFn;
  }

  function manage<Resource>(name: string, inputResource: Operation<Resource>) {
    const CustomContext = createContext<Resource>(name);
    function curVisor(scope: Scope) {
      return supervise(function* () {
        const providedResource = yield* inputResource;
        scope.set(CustomContext, providedResource);
        yield* suspend();
      });
    }

    watch.send(curVisor);

    // returns to the user so they can use this resource from
    //  anywhere this context is available
    return CustomContext;
  }

  function* register() {
    const scope = yield* useScope();
    const parentStoreId = scope.get(IdContext);
    if (parentStoreId && storeRegistration.has(parentStoreId)) {
      console.warn("This thunk instance is already registered.");
      return;
    }
    storeRegistration.add(parentStoreId);

    yield* ensure(function* () {
      storeRegistration.delete(parentStoreId);
    });

    // wait for further thunk create
    for (const watched of yield* each(watch)) {
      yield* scope.spawn(watched(scope));
      yield* each.next();
    }
  }

  function routes() {
    function* router(ctx: Ctx, next: Next) {
      const match = dynamicMiddlewareMap[ctx.name] || middlewareMap[ctx.name];
      if (!match) {
        yield* next();
        return;
      }

      const result = yield* match(ctx, next);
      return result;
    }

    return router;
  }

  function resetMdw() {
    dynamicMiddlewareMap = {};
  }

  return {
    use: (fn: Middleware<Ctx>) => {
      middleware.push(fn);
    },
    create,
    manage,
    routes,
    reset: resetMdw,
    register,
  };
}
