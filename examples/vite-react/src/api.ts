import { createApi, createSchema, mdw, slice } from "starfx";
import { guessAge } from "./age-guess";

interface User {
  id: string;
  name: string;
  age: number;
}

const emptyUser: User = { id: "", name: "", age: 0 };
export const schema = createSchema({
  users: slice.table({ empty: emptyUser }),
  cache: slice.table(),
  loaders: slice.loaders(),
});
export type AppState = typeof schema.initialState;

export const api = createApi();
api.use(mdw.api({ schema }));
api.use(api.routes());
api.use(mdw.fetch({ baseUrl: "https://jsonplaceholder.typicode.com" }));
const Guesser = api.manage("guesser", guessAge());

export const fetchUsers = api.get<never, Omit<User, "age">[]>(
  "/users",
  function* (ctx, next) {
    yield* next();

    if (!ctx.json.ok) {
      return;
    }

    console.log("guesser.get", "next should not have undefined");
    const g = yield* Guesser.get();
    let l = console.log;
    if (!g) {
      // log error only if guesser is not available
      // to make it easier to see when the resource is missing
      l = console.error;
    }
    l("guesser.guess", g?.guess);
    l("guesser.accumulated", g?.accumulated);

    const users = {} as Record<string, User>;
    for (const user of ctx.json.value) {
      users[user.id] = { id: user.id, name: user.name, age: g?.guess ?? 1 };
    }

    yield* schema.update(schema.users.add(users));
  }
);
