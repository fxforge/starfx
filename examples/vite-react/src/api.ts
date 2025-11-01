import { createApi, createSchema, mdw, slice } from "starfx";
import { guessAge } from "./age-guess";

interface User {
  id: string;
  name: string;
  age: number
}

const emptyUser: User = { id: "", name: "", age: 0 };
export const [schema, initialState] = createSchema({
  users: slice.table({ empty: emptyUser }),
  cache: slice.table(),
  loaders: slice.loaders(),
});
export type AppState = typeof initialState;

export const api = createApi();
api.use(mdw.api({ schema }));
api.use(api.routes());
api.use(mdw.fetch({ baseUrl: "https://jsonplaceholder.typicode.com" }));
const Guesser = api.manage('guesser',guessAge())

export const fetchUsers = api.get<never, Omit<User,"age">[]>(
  "/users",
  function* (ctx, next) {
    yield* next();

    if (!ctx.json.ok) {
      return;
    }

    console.log("guesser.expect")
    const g = yield* Guesser.get()
    console.log(g, Guesser)

    const users = {} as Record<string, User>
    for (const user of ctx.json.value) {
      users[user.id] = {id: user.id, name: user.name, age: g?.guess ?? 1}
    }

    yield* schema.update(schema.users.add(users));
  },
);
