import React from "react";
import { Provider } from "../react.js";
import { createSchema, createStore, slice } from "../store/index.js";
import { expect, test } from "../test.js";

// typing test
test("react types", () => {
  const schema = createSchema({
    cache: slice.table(),
    loaders: slice.loaders(),
  });
  const store = createStore({ schemas: [schema] });
  React.createElement(Provider, {
    schema,
    store,
    children: React.createElement("div"),
  });
  expect(true).toBe(true);
});
