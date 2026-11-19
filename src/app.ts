import Fastify, { type FastifyServerOptions } from "fastify";
import type { Model } from "./ai/model.js";
import { healthRoutes } from "./api/routes/health.js";
import { ticketRoutes } from "./api/routes/tickets.js";
import type { Database } from "./infrastructure/database/client.js";

// The caller owns these. Tests pass a Testcontainers client and a mock model.
// The caller also closes the database after app.close().
export interface AppDependencies {
  db: Database;
  model: Model;
}

export async function buildApp({ db, model }: AppDependencies, opts: FastifyServerOptions = {}) {
  const app = Fastify(opts);

  await app.register(healthRoutes);
  await app.register(ticketRoutes, { db, model });

  return app;
}
