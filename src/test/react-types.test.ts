import { describe, expectTypeOf, test } from "vitest";
import {
  type UseApiAction,
  type UseApiProps,
  type UseApiSimpleProps,
  type UseCacheResult,
  useApi,
  useCache,
  useLoader,
  useQuery,
  useSchema,
  useSchemaWithCache,
  useSchemaWithLoaders,
  useStore,
} from "../react.js";
import { createSchema, createStore, slice } from "../store/index.js";
import type {
  FxSchema,
  FxStore,
  SliceFromSchema,
} from "../store/types.js";
import type { LoaderOutput, ObjOutput, TableOutput } from "../store/slice/index.js";
import type { ActionFn, ActionFnWithPayload, AnyState, LoaderState } from "../types.js";
import type { ThunkAction } from "../query/index.js";

interface User {
  id: string;
  name: string;
}

type Metadata = Record<string, string>;

type AppMap = {
  cache: (name: string) => TableOutput<AnyState>;
  loaders: (name: string) => LoaderOutput;
  metadata: (name: string) => ObjOutput<Metadata>;
  users: (name: string) => TableOutput<User>;
};

declare const fetchUsersAction: ThunkAction<{ page: number }, User[]>;
declare const saveUserAction: ActionFnWithPayload<User>;
declare const refreshUsersAction: ActionFn;

describe("react hook types", () => {
  test("typed schema/store creation works with react-facing types", () => {
    const schema = createSchema({
      cache: slice.table(),
      loaders: slice.loaders(),
      metadata: slice.obj<Metadata>({}),
      users: slice.table<User>(),
    });
    const store = createStore({ schemas: [schema] });

    expectTypeOf(schema).toExtend<FxSchema<AppMap>>();
    expectTypeOf(store).toExtend<FxStore<AppMap>>();
  });

  test("useSchema returns typed schema", () => {
    const useTypedSchema = () => useSchema<AppMap>();
    expectTypeOf(useTypedSchema).returns.toEqualTypeOf<FxSchema<AppMap>>();
  });

  test("useSchemaWithLoaders returns typed schema", () => {
    type WithLoaders = AppMap & { loaders: (name: string) => LoaderOutput };
    const useTypedSchema = () => useSchemaWithLoaders<WithLoaders>();
    expectTypeOf(useTypedSchema).returns.toEqualTypeOf<FxSchema<WithLoaders>>();
  });

  test("useSchemaWithCache returns typed schema", () => {
    type WithCache = AppMap & { cache: (name: string) => TableOutput<AnyState> };
    const useTypedSchema = () => useSchemaWithCache<WithCache>();
    expectTypeOf(useTypedSchema).returns.toEqualTypeOf<FxSchema<WithCache>>();
  });

  test("useStore returns typed store", () => {
    const useTypedStore = () => useStore<AppMap>();
    expectTypeOf(useTypedStore).returns.toEqualTypeOf<FxStore<AppMap>>();
  });

  test("useLoader accepts thunk actions and returns loader state", () => {
    const useThunkLoader = () => useLoader<AppMap, typeof fetchUsersAction>(fetchUsersAction);
    expectTypeOf(useThunkLoader).returns.toEqualTypeOf<LoaderState>();
  });

  test("useApi infers thunk action result", () => {
    const useThunkApi = () => useApi(fetchUsersAction);
    expectTypeOf(useThunkApi).returns.toExtend<
      UseApiAction<typeof fetchUsersAction>
    >();
  });

  test("useApi infers payload action function result", () => {
    const usePayloadApi = () => useApi(saveUserAction);
    expectTypeOf(usePayloadApi).returns.toExtend<UseApiProps<User>>();
  });

  test("useApi infers simple action function result", () => {
    const useSimpleApi = () => useApi(refreshUsersAction);
    expectTypeOf(useSimpleApi).returns.toExtend<UseApiSimpleProps>();
  });

  test("useQuery returns thunk api shape", () => {
    const useThunkQuery = () => useQuery(fetchUsersAction);
    expectTypeOf(useThunkQuery).returns.toExtend<
      UseApiAction<typeof fetchUsersAction>
    >();
  });

  test("useCache returns cached thunk result type", () => {
    const useThunkCache = () => useCache<AppMap, { page: number }, User[]>(fetchUsersAction);
    expectTypeOf(useThunkCache).returns.toExtend<
      UseCacheResult<User[], typeof fetchUsersAction>
    >();
  });

  test("useSchema supports custom slice selectors", () => {
    const useMetadataSelect = () => {
      const schema = useSchema<AppMap>();
      return schema.metadata.select;
    };

    expectTypeOf(useMetadataSelect).returns.toExtend<
      ObjOutput<Metadata>["select"]
    >();
  });
});
