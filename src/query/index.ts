import { type ThunksApi, createThunks } from "./thunk.js";

export * from "./api.js";
export * from "./types.js";
export * from "./create-key.js";

export { createThunks, type ThunksApi };

/**
 * @deprecated Use {@link createThunks} instead. This alias will be removed in a future version.
 */
export const createPipe = createThunks;
