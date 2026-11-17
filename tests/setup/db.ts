import { execSync } from "node:child_process";
import { PostgreSqlContainer } from "@testcontainers/postgresql";
import type { TestProject } from "vitest/node";

declare module "vitest" {
  export interface ProvidedContext {
    databaseUrl: string;
  }
}

// Same image as docker-compose.yml, so tests run on the same Postgres version.
const POSTGRES_IMAGE = "postgres:18.7-alpine";

// Starts a new Postgres container for this test run, applies the migrations,
// and gives the URL to the tests. The container stops after the run.
export default async function setup(project: TestProject) {
  const container = await new PostgreSqlContainer(POSTGRES_IMAGE).start();
  const databaseUrl = container.getConnectionUri();

  // src/config/env.ts needs DATABASE_URL when a test imports it.
  // This value wins over .env, because dotenv does not replace set variables.
  process.env.DATABASE_URL = databaseUrl;

  execSync("npx prisma migrate deploy", {
    env: { ...process.env, DATABASE_URL: databaseUrl },
    stdio: "pipe",
  });

  project.provide("databaseUrl", databaseUrl);

  return async () => {
    await container.stop();
  };
}
