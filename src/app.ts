import type { LanguageModel } from "ai";
import Fastify, { type FastifyServerOptions } from "fastify";
import { healthRoutes } from "./api/routes/health.js";
import type { Database } from "./infrastructure/database/client.js";

// The caller owns these. Tests pass a Testcontainers client and a mock model.
// The caller also closes the database after app.close().
export interface AppDependencies {
  db: Database;
  // Optional until the ticket analysis route uses it.
  model?: LanguageModel;
}

export async function buildApp(_deps: AppDependencies, opts: FastifyServerOptions = {}) {
  const app = Fastify(opts);

  await app.register(healthRoutes);

  return app;
}
