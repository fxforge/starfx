import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: [
      {
        find: "starfx/react",
        replacement: resolve(__dirname, "./node_modules/starfx/dist/esm/react.js"),
      },
      {
        find: "starfx",
        replacement: resolve(__dirname, "./vitest.starfx.ts"),
      },
      {
        find: "react",
        replacement: resolve(__dirname, "./node_modules/react"),
      },
      {
        find: "react-dom",
        replacement: resolve(__dirname, "./node_modules/react-dom"),
      },
      {
        find: "react-redux",
        replacement: resolve(__dirname, "./node_modules/react-redux"),
      },
    ],
    dedupe: ["react", "react-dom", "react-redux"],
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./tests/setup.ts"],
  },
});