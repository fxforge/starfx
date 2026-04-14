import { createApi, createSchema, mdw, slice } from "starfx";
import { createTypedHooks } from "starfx/react";

const emptyUser = { id: "", name: "" };
type User = typeof emptyUser;
export const schema = createSchema({
  users: slice.table({ empty: emptyUser }),
  cache: slice.table(),
  loaders: slice.loaders(),
});

export const api = createApi();
api.use(mdw.api({ schema }));
api.use(api.routes());
api.use(mdw.fetch({ baseUrl: "https://jsonplaceholder.typicode.com" }));

export const fetchUsers = api.get("/users", function* (ctx, next) {
  yield* next();

  if (!ctx.json.ok) {
    return;
  }

  const users = (ctx.json.value as User[]).reduce<Record<string, User>>((acc, user) => {
    acc[user.id] = user;
    return acc;
  }, {});

  yield* schema.update(schema.users.add(users));
});


const { useSelector } = createTypedHooks(schema);
export { useSelector };
