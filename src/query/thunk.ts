import {
  type Context,
  Ok,
  type Operation,
  type Scope,
  createContext,
  each,
  ensure,
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

export interface ThunksApi<Ctx extends ThunkCtx> {
  use: (fn: Middleware<Ctx>) => void;
  routes: () => Middleware<Ctx>;
  register: () => Operation<void>;
  reset: () => void;
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
 * Creates a middleware pipeline.
 *
 * @remarks
 * This middleware pipeline is almost exactly like koa's middleware system.
 * See {@link https://koajs.com}
 *
 * @example
 * ```ts
 * import { createThunks } from 'starfx';
 *
 * const thunks = createThunks();
 * thunks.use(function* (ctx, next) {
 *   console.log('beginning');
 *   yield* next();
 *   console.log('end');
 * });
 * thunks.use(thunks.routes());
 *
 * const doit = thunks.create('do-something', function*(ctx, next) {
 *   console.log('middle');
 *   yield* next();
 *   console.log('middle end');
 * });
 *
 * // ...
 *
 * store.dispatch(doit());
 * // beginning
 * // middle
 * // middle end
 * // end
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

  function manage<Resource>(name: string, resource: Operation<Resource>) {
    const CustomContext = createContext<Resource>(name);
    function curVisor(scope: Scope) {
      function* kickoff(): Operation<void> {
        const providedResource = yield* resource;
        scope.set(CustomContext, providedResource);
      }
      return kickoff;
    }

    watch.send(curVisor);

    // returns to the user can use this resource from
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
