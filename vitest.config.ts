import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // Starts a Postgres container with Testcontainers. Docker must run.
    globalSetup: ["tests/setup/db.ts"],
    // All test files share one database, and seedDatabase() deletes every row.
    // Files that run at the same time would delete each other's rows.
    fileParallelism: false,
    // The first run pulls the image, and that can take more than the default.
    hookTimeout: 120_000,
  },
});
