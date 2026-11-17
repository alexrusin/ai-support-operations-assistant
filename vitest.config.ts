import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // Starts a Postgres container with Testcontainers. Docker must run.
    globalSetup: ["tests/setup/db.ts"],
    // The first run pulls the image, and that can take more than the default.
    hookTimeout: 120_000,
  },
});
