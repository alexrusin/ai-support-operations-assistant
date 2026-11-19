import { createOpenAIModel } from "./ai/model.js";
import { buildApp } from "./app.js";
import { config } from "./config/env.js";
import { createPrismaClient } from "./infrastructure/database/client.js";

if (!config.OPENAI_API_KEY) {
  console.error("OPENAI_API_KEY is not set. Add it to .env (see .env.example) and start the server again.");
  process.exit(1);
}

const db = createPrismaClient();
const model = createOpenAIModel(config.OPENAI_API_KEY, config.AI_MODEL);
const app = await buildApp({ db, model }, { logger: { level: config.LOG_LEVEL } });

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
