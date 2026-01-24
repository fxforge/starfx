import { type ThunksApi, createThunks } from "./thunk.js";

export * from "./api.js";
export * from "./types.js";
export * from "./create-key.js";

export { createThunks, type ThunksApi };

/**
 * @deprecated Use {@link createThunks} instead;
 */
/**
 * Alias for {@link createThunks} to support a pipe-oriented naming convention.
 */
export const createPipe = createThunks;
