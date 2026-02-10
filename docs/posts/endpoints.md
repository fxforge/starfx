---
title: Endpoints
description: endpoints are tasks for managing HTTP requests
---

An endpoint is just a specialized thunk designed to manage http requests. It has
a supervisor, it has a middleware stack, and it hijacks the unique id for our
thunks and turns it into a router.

```ts
import { createApi, createStore, mdw } from "starfx";
import { initialState, schema } from "./schema";

const api = createApi();
// composition of handy middleware for createApi to function
api.use(mdw.api({ schema }));
api.use(api.routes());
// calls `window.fetch` with `ctx.request` and sets to `ctx.response`
api.use(mdw.fetch({ baseUrl: "https://jsonplaceholder.typicode.com" }));

// automatically cache Response json in datastore as-is
export const fetchUsers = api.get("/users", api.cache());

// create a POST HTTP request
export const updateUser = api.post<{ id: string; name: string }>(
  "/users/:id",
  function* (ctx, next) {
    ctx.request = ctx.req({
      body: JSON.stringify({ name: ctx.payload.name }),
    });
    yield* next();
  }
);

const store = createStore(initialState);
store.initialize(api.register);

store.dispatch(fetchUsers());
// now accessible with useCache(fetchUsers)

// lets update a user record
store.dispatch(updateUser({ id: "1", name: "bobby" }));
```

# Enforcing fetch response type

When using `createApi` and `mdw.fetch` we can provide the type that we think
will be returned by the fetch response:

```ts
interface Success {
  users: User[];
}

interface Err {
  error: string;
}

const fetchUsers = api.get<never, Success, Err>(
  "/users",
  function* (ctx, next) {
    yield* next();

    if (!ctx.json.ok) {
      // we have an error type
      console.log(ctx.json.value.error);
      return;
    }

    // we have a success type
    console.log(ctx.json.value.users);
  },
);
```

When calling `createApi` you can also pass it a generic error type that all
endpoints inherit:

```ts
import type { ApiCtx } from "starfx";

type MyApiCtx<P = any, S = any> = ApiCtx<P, S, { error: string }>;

const api = createApi<MyApiCtx>();

// this will inherit the types from `MyApiCtx`
const fetchUsers = api.get<never, Success>(
  "/users",
  function* (ctx, next) {
    yield* next();

    if (!ctx.json.ok) {
      // we have an error type
      console.log(ctx.json.value.error);
      return;
    }

    // we have a success type
    console.log(ctx.json.value.users);
  },
);
```

# Using variables inside the API endpoint

Just like other popular server-side routing libraries, we have a way to provide
slots in our URI to fill with actual values. This is critical for CRUD
operations that have ids inside the URI.

```ts
const fetchUsersByAccount = api.get<{ id: string }>("/accounts/:id/users");
const fetchServices = api.get<{ accountId: string; appId: string }>(
  "/accounts/:accountId/apps/:appId/services",
);
```

One ergonomic feature we baked into this functionality is: what happens when
`id` is empty?

```ts
const fetchUsersByAccount = api.get<{ id: string }>("/accounts/:id/users");
store.dispatch(fetchUsersByAccount({ id: "" }));
```

In this case we detect that there is no id and bail early. So you can hit this
endpoint with empty data and it'll just exit early. Convenient when the view
just throws around data without checking if it is filled.

# The same API endpoints but different logic

It is very common to have the same endpoint with different business logic
associated with it.

For example, sometimes I need a simple `fetchUsers` endpoint as well as a
`fetchUsersPoll` endpoint, essentially the same endpoint, but different
supervisor tasks.

Since the router is defined by a thunk id that must be unique, we have to
support a workaround:

```ts
const fetchUsers = api.get("/users");
const fetchUsersPoll = api.get(["/users", "poll"], { supervisors: poll() });
```

The first part of the array is what is used for the router, everything else is
unused. This lets you create as many different variations of calling that
endpoint that you need.

# `ctx.request`

This is a `Request` object that will feed directly into a `fetch` request.
End-users are able to manipulate it however they want regardless of what was set
on it previously. We have mdw that will automatically manipulate it but it all
lives inside the mdw stack that the end-user can control.

# Using `ctx.req`

`ctx.req` is a helper function to merge what currently exists inside
`ctx.request` with new properties. It is gaurenteed to return a valid `Request`
object and performs a deep merge between `ctx.request` and what the user
provides to it.

```ts
const fetchUsers = api.get("/users", function*(ctx, next) {
  ctx.request = ctx.req({
    url: "/psych",
    headers: {
      "Content-Type": "yoyo",
    },
  });
  yield* next();
}
```

# `ctx.response`

This is a fetch `Response` object that our `mdw.fetch` will fill automatically.

# `ctx.json`

Our `mdw.fetch` will automatically fill this value as a `Result` type derived
from `Response.json`. Success or failure of this property is determined by
`Response.ok` and if we can successully call `Response.json` without errors.

# Middleware automation

Because endpoints use the same powerful middleware system employed by thunks, we
can do quite a lot of automating for API requests -- to the point where an
endpoint doesn't have a custom middleware function at all.

For example, if you API leverages an API specification like
[JSON API](https://jsonapi.org), then we can automate response processing.

Given the following API response:

```json
{
  "links": {
    "self": "http://example.com/articles",
    "next": "http://example.com/articles?page[offset]=2",
    "last": "http://example.com/articles?page[offset]=10"
  },
  "data": [{
    "type": "articles",
    "id": "1",
    "attributes": {
      "title": "JSON:API paints my bikeshed!"
    },
    "relationships": {
      "author": {
        "links": {
          "self": "http://example.com/articles/1/relationships/author",
          "related": "http://example.com/articles/1/author"
        },
        "data": { "type": "people", "id": "9" }
      },
      "comments": {
        "links": {
          "self": "http://example.com/articles/1/relationships/comments",
          "related": "http://example.com/articles/1/comments"
        },
        "data": [
          { "type": "comments", "id": "5" },
          { "type": "comments", "id": "12" }
        ]
      }
    },
    "links": {
      "self": "http://example.com/articles/1"
    }
  }],
  "included": [{
    "type": "people",
    "id": "9",
    "attributes": {
      "firstName": "Dan",
      "lastName": "Gebhardt",
      "twitter": "dgeb"
    },
    "links": {
      "self": "http://example.com/people/9"
    }
  }, {
    "type": "comments",
    "id": "5",
    "attributes": {
      "body": "First!"
    },
    "relationships": {
      "author": {
        "data": { "type": "people", "id": "2" }
      }
    },
    "links": {
      "self": "http://example.com/comments/5"
    }
  }, {
    "type": "comments",
    "id": "12",
    "attributes": {
      "body": "I like XML better"
    },
    "relationships": {
      "author": {
        "data": { "type": "people", "id": "9" }
      }
    },
    "links": {
      "self": "http://example.com/comments/12"
    }
  }]
}
```

We could create a middleware:

```ts
import { createApi, mdw } from "starfx";
import {
  createSchema,
  select,
  slice,
  storeMdw,
  StoreUpdater,
} from "starfx/store";

interface Article {
  id: string;
  title: string;
  authorId: string;
  comments: string[];
}

function deserializeArticle(art: any): Article {
  return {
    id: art.id,
    title: art.attributes.title,
    authorId: art.relationships.author.data.id,
    comments: art.relationships.comments.data.map((c) => c.id),
  };
}

interface Person {
  id: string;
  firstName: string;
  lastName: string;
  twitter: string;
}

function deserializePerson(per: any): Person {
  return {
    id: per.id,
    firstName: per.attributes.firstName,
    lastName: per.attributes.lastName,
    twitter: per.attributes.twitter,
  };
}

interface Comment {
  id: string;
  body: string;
  authorId: string;
}

function deserializeComment(com: any): Comment {
  return {
    id: comm.id,
    body: com.attributes.body,
    authorId: com.relationships.author.data.id,
  };
}

const [schema, initialState] = createSchema({
  cache: slice.table(),
  loaders: slice.loaders(),
  token: slice.str(),
  articles: slice.table<Article>(),
  people: slice.table<Person>(),
  comments: slice.table<Comment>(),
});
type WebState = typeof initialState;

const api = createApi();
api.use(mdw.api({ schema }));
api.use(api.routes());

// do some request setup before making fetch call
api.use(function* (ctx, next) {
  const token = yield* select(schema.token.select);
  ctx.request = ctx.req({
    headers: {
      "Content-Type": "application/vnd.api+json",
      "Authorization": `Bearer ${token}`,
    },
  });

  yield* next();
});

api.use(mdw.fetch({ baseUrl: "https://json-api.com" }));

function process(entity: any): StoreUpdater[] {
  if (entity.type === "article") {
    const article = deserializeArticle(entity);
    return [schema.articles.add({ [article.id]: article })];
  } else if (entity.type === "people") {
    const person = deserializePerson(entity);
    return [schema.people.add({ [person.id]: person })];
  } else if (entity.type === "comment") {
    const comment = deserializeComment(entity);
    return [schema.comments.add({ [comment.id]: comment })];
  }

  return [];
}

// parse response
api.use(function* (ctx, next) {
  // wait for fetch response
  yield* next();

  if (!ctx.json.ok) {
    // bail
    return;
  }

  const updaters: StoreUpdater<WebState>[] = [];
  const jso = ctx.json.value;

  if (Array.isArray(jso.data)) {
    jso.data.forEach(
      (entity) => updaters.push(...process(entity)),
    );
  } else {
    updaters.push(...process(jso.data));
  }

  jso.included.forEach(
    (entity) => updaters.push(...process(entity)),
  );

  yield* schema.update(updaters);
});
```

Now when we create the endpoints, we really don't need a mdw function for them
because everything is automated higher in the mdw stack:

```ts
const fetchArticles = api.get("/articles");
const fetchArticle = api.get<{ id: string }>("/articles/:id");
const fetchCommentsByArticleId = api.get<{ id: string }>(
  "/articles/:id/comments",
);
const fetchComment = api.get<{ id: string }>("/comments/:id");
```

This is simple it is silly not to nomalize the data because we get a ton of
benefits from treating our front-end store like a database. CRUD operations
become trivial and app-wide.
