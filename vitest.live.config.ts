import { defineConfig } from "vitest/config";
import baseConfig from "./vitest.config.js";

// Live tests call paid APIs. `npm test` and CI do not run them.
// The spread replaces include. mergeConfig would add to it.
export default defineConfig({
  test: {
    ...baseConfig.test,
    include: ["tests/live/**/*.live.ts"],
    testTimeout: 60_000,
  },
});
