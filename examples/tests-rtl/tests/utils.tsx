import React, { type ReactElement } from "react";
import { render, type RenderOptions } from "@testing-library/react";
import { Provider } from "starfx/react";
import { setupStore } from "../src/store";

const AllTheProviders = ({ children }: { children: React.ReactNode }) => {
  const store = setupStore({});
  return <Provider store={store}>{children}</Provider>;
};

const customRender = (
  ui: ReactElement,
  options?: Omit<RenderOptions, "wrapper">
) => render(ui, { wrapper: AllTheProviders, ...options });

// re-export everything
export * from "@testing-library/react";

// override render method
export { customRender as render };
