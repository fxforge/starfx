import { type Operation, createContext, suspend } from "effection";
import { supervise } from "../fx/supervisor.js";
import { StoreContext } from "./context.js";

/**
 * Creates a managed resource within the store's Effection scope.
 *
 * @remarks
 * The `registerResource` function creates a named context that can be used
 * by operations running inside the store scope. The returned context exposes
 * an `.initialize` method, which is intended for `createStore({ tasks: [...] })`.
 *
 * @param name - A unique name for the resource, used to create a context.
 * @param inputResource - An Effection operation that initializes the resource.
 * @returns A context object with an `initialize` method for setting up the resource.
 */
export function registerResource<Resource>(
  name: string,
  inputResource: Operation<Resource>,
) {
  const CustomContext = createContext<Resource>(name);
  const initialize = supervise(function* () {
    const store = yield* StoreContext.expect();
    const parentScope = store.getScope();
    const providedResource = yield* inputResource;
    parentScope.set(CustomContext, providedResource);
    yield* suspend();
  });

  return { ...CustomContext, initialize };
}
