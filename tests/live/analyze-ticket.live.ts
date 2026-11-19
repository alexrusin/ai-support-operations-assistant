import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";
import { SEED_IDS, seedDatabase } from "../../prisma/seed-data.js";
import { createOpenAIModel } from "../../src/ai/model.js";
import { buildApp } from "../../src/app.js";
import { config } from "../../src/config/env.js";
import { createPrismaClient, type Database } from "../../src/infrastructure/database/client.js";

// Calls the real OpenAI model. Run it with `npm run test:live`.
// It is skipped when OPENAI_API_KEY is not set in the environment or .env.
const apiKey = config.OPENAI_API_KEY;

describe.skipIf(!apiKey)("live: POST /tickets/:id/analyze", () => {
  let db: Database;
  let app: FastifyInstance;

  beforeAll(async () => {
    db = createPrismaClient(inject("databaseUrl"));
    await seedDatabase(db);
    app = await buildApp({ db, model: createOpenAIModel(apiKey!, config.AI_MODEL) }, { logger: false });
  });

  afterAll(async () => {
    await app?.close();
    await db?.$disconnect();
  });

  it("analyzes a seed ticket and records real token counts", async () => {
    const ticketId = SEED_IDS.duplicateCharge.ticket;

    const res = await app.inject({ method: "POST", url: `/tickets/${ticketId}/analyze` });

    expect(res.statusCode).toBe(200);
    const body = res.json<{ runId: string; output: { text: string } }>();
    expect(body.output.text.length).toBeGreaterThan(0);

    const run = await db.run.findUniqueOrThrow({ where: { id: body.runId } });
    expect(run.model).toBe(config.AI_MODEL);
    expect(run.error).toBeNull();
    expect(run.inputTokens).toBeGreaterThan(0);
    expect(run.outputTokens).toBeGreaterThan(0);
    expect(run.latencyMs).toBeGreaterThan(0);
  });
});
