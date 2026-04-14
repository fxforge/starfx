import "@testing-library/jest-dom";
import { expect, test } from "@jest/globals";
import { fireEvent, render, screen, waitFor } from "./utils";
import { fetchUsers } from "../src/api";
import { App } from "../src/app";

test("loads homepage", async () => {
  render(<App id="1" />);
  expect(screen.getByRole("heading")).toHaveTextContent("hi there");
});

test("fetches users", async () => {
  fetchUsers.use(function* (ctx, next) {
    ctx.response = new Response(
      JSON.stringify([
        {
          id: 1,
          name: "Leanne Graham",
        },
        {
          id: 2,
          name: "Ervin Howell",
        },
      ])
    );
    yield* next();
  });

  render(<App id="1" />);

  expect(screen.getByRole("heading")).toHaveTextContent("hi there");

  const btn = await screen.findByRole("button", { name: /Fetch users/ });
  fireEvent.click(btn);

  await waitFor(() => {
    expect(screen.getByText("(1) Leanne Graham")).toBeInTheDocument();
  });
  await waitFor(() => {
    expect(screen.getByText("(2) Ervin Howell")).toBeInTheDocument();
  });
});
