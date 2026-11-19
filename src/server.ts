import { buildApp } from "./app.js";
import { config } from "./config/env.js";
import { createPrismaClient } from "./infrastructure/database/client.js";

const db = createPrismaClient();
const app = await buildApp({ db }, { logger: { level: config.LOG_LEVEL } });

const shutdown = async (signal: string) => {
  app.log.info({ signal }, "shutting down");
  await app.close();
  await db.$disconnect();
  process.exit(0);
};

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));

try {
  await app.listen({ port: config.PORT, host: config.HOST });
} catch (err) {
  app.log.error(err);
  await db.$disconnect();
  process.exit(1);
}
