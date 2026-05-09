import { describe, expectTypeOf, test } from "vitest";
import type { ReactElement } from "react";
import type { ThunkAction } from "../query/index.js";
import {
  Provider,
  type UseApiAction,
  type UseApiProps,
  type UseApiSimpleProps,
  type UseCacheResult,
  createTypedHooks,
  useApi,
  useCache,
  useLoader,
  useQuery,
  useSchema,
  useSchemaWithCache,
  useSchemaWithLoaders,
  useSelector,
  useStore,
} from "../react.js";
import { createSchema, createStore, slice } from "../store/index.js";
import type {
  LoaderOutput,
  ObjOutput,
  TableOutput,
} from "../store/slice/index.js";
import type { FxSchema, FxStore } from "../store/types.js";
import type {
  ActionFn,
  ActionFnWithPayload,
  AnyState,
  LoaderState,
} from "../types.js";

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
  describe("global hooks without schema hints", () => {
    test("typed schema/store creation works with react-facing types", () => {
      const schema = createSchema({
        cache: slice.table(),
        loaders: slice.loaders(),
        metadata: slice.obj<Metadata>({}),
        users: slice.table<User>(),
      });
      const store = createStore({ schema });

      expectTypeOf(schema).toExtend<FxSchema<AppMap>>();
      expectTypeOf(store).toExtend<FxStore<AppMap>>();
    });

    test("bare useSelector works with schema selectors", () => {
      const schema = createSchema({
        cache: slice.table(),
        loaders: slice.loaders(),
        metadata: slice.obj<Metadata>({}),
        users: slice.table<User>(),
      });
      const useUsers = () => useSelector(schema.users.selectTableAsList);

      expectTypeOf(useUsers).returns.toEqualTypeOf<
        ReturnType<typeof schema.users.selectTableAsList>
      >();
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
  });

  describe("schema-bound typed hooks", () => {
    test("useSelector exposes schema state to userland", () => {
      const schema = createSchema({
        cache: slice.table(),
        loaders: slice.loaders(),
        metadata: slice.obj<Metadata>({}),
        users: slice.table<User>(),
      });
      const hooks = createTypedHooks(schema);
      const useUsers = () => hooks.useSelector((state) => state.users);
      const useMetadata = () =>
        hooks.useSelector((state) => state.metadata.example);

      expectTypeOf(useUsers).returns.toEqualTypeOf<
        Record<string | number, User>
      >();
      expectTypeOf(useMetadata).returns.toEqualTypeOf<string>();
    });

    test("createTypedHooks infers all hook state from schema input", () => {
      const schema = createSchema({
        cache: slice.table(),
        loaders: slice.loaders(),
        metadata: slice.obj<Metadata>({}),
        users: slice.table<User>(),
      });
      const hooks = createTypedHooks(schema);
      const useUsers = () => hooks.useSelector((state) => state.users);
      const useSchemaState = () => hooks.useSchema();
      const useTypedLoader = () => hooks.useLoader(fetchUsersAction);

      expectTypeOf(useUsers).returns.toEqualTypeOf<
        Record<string | number, User>
      >();
      expectTypeOf(useSchemaState).returns.toEqualTypeOf<typeof schema>();
      expectTypeOf(useTypedLoader).returns.toEqualTypeOf<LoaderState>();
    });

    test("Provider accepts stores with merged root state and narrower default schema", () => {
      const baseSchema = createSchema({
        users: slice.table<User>(),
      });
      const metadataSchema = createSchema({
        metadata: slice.obj<Metadata>({}),
      });
      const store = createStore({
        schema: { default: baseSchema, metadata: metadataSchema },
      });

      const renderProvider = () => Provider({ store, children: null });

      expectTypeOf(renderProvider).returns.toEqualTypeOf<ReactElement>();
    });
  });

  describe("direct hooks with explicit schema generics", () => {
    test("useSchema returns typed schema", () => {
      const useTypedSchema = () => useSchema<AppMap>();
      expectTypeOf(useTypedSchema).returns.toEqualTypeOf<FxSchema<AppMap>>();
    });

    test("useSchemaWithLoaders returns typed schema", () => {
      type WithLoaders = AppMap & { loaders: (name: string) => LoaderOutput };
      const useTypedSchema = () => useSchemaWithLoaders<WithLoaders>();
      expectTypeOf(useTypedSchema).returns.toEqualTypeOf<
        FxSchema<WithLoaders>
      >();
    });

    test("useSchemaWithCache returns typed schema", () => {
      type WithCache = AppMap & {
        cache: (name: string) => TableOutput<AnyState>;
      };
      const useTypedSchema = () => useSchemaWithCache<WithCache>();
      expectTypeOf(useTypedSchema).returns.toEqualTypeOf<FxSchema<WithCache>>();
    });

    test("useStore returns typed store", () => {
      const useTypedStore = () => useStore<AppMap>();
      expectTypeOf(useTypedStore).returns.toEqualTypeOf<FxStore<AppMap>>();
    });

    test("useSelector supports explicit state and selected generics", () => {
      const useUsers = () =>
        useSelector<AppMap, Record<string | number, User>>(
          (state) => state.users,
        );

      expectTypeOf(useUsers).returns.toEqualTypeOf<
        Record<string | number, User>
      >();
    });

    test("hooks support explicit schema hints when used directly", () => {
      const useTypedApi = () =>
        useApi<AppMap, typeof fetchUsersAction>(fetchUsersAction);
      const useTypedQuery = () =>
        useQuery<AppMap, typeof fetchUsersAction>(fetchUsersAction);
      const useTypedCache = () =>
        useCache<AppMap, { page: number }, User[]>(fetchUsersAction);

      expectTypeOf(useTypedApi).returns.toExtend<
        UseApiAction<typeof fetchUsersAction>
      >();
      expectTypeOf(useTypedQuery).returns.toExtend<
        UseApiAction<typeof fetchUsersAction>
      >();
      expectTypeOf(useTypedCache).returns.toExtend<
        UseCacheResult<User[], typeof fetchUsersAction>
      >();
    });

    test("useLoader accepts thunk actions and returns loader state", () => {
      const useThunkLoader = () =>
        useLoader<AppMap, typeof fetchUsersAction>(fetchUsersAction);
      expectTypeOf(useThunkLoader).returns.toEqualTypeOf<LoaderState>();
    });

    test("useCache returns cached thunk result type", () => {
      const useThunkCache = () =>
        useCache<AppMap, { page: number }, User[]>(fetchUsersAction);
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
});
