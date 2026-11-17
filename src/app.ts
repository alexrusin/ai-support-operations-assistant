import Fastify, { type FastifyServerOptions } from "fastify";
import { healthRoutes } from "./routes/health.js";

export async function buildApp(opts: FastifyServerOptions = {}) {
  const app = Fastify(opts);

  await app.register(healthRoutes);

  return app;
}
