import { setTimeout as sleep } from "node:timers/promises";
import { MockLanguageModelV4 } from "ai/test";
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";
import { SEED_IDS, seedDatabase } from "../../prisma/seed-data.js";
import { buildApp } from "../../src/app.js";
import { createPrismaClient, type Database } from "../../src/infrastructure/database/client.js";

const MOCK_TEXT = "The customer was charged two times and wants one refund.";

const model = new MockLanguageModelV4({
  modelId: "mock-model",
  doGenerate: async () => {
    // A real call takes time. Without a wait the latency can round to 0 ms.
    await sleep(5);
    return {
      content: [{ type: "text", text: MOCK_TEXT }],
      finishReason: { unified: "stop", raw: "stop" },
      usage: {
        inputTokens: { total: 42, noCache: 42, cacheRead: 0, cacheWrite: 0 },
        outputTokens: { total: 17, text: 17, reasoning: 0 },
      },
      warnings: [],
    };
  },
});

describe("POST /tickets/:id/analyze", () => {
  let db: Database;
  let app: FastifyInstance;

  beforeAll(async () => {
    db = createPrismaClient(inject("databaseUrl"));
    await seedDatabase(db);
    app = await buildApp({ db, model }, { logger: false });
  });

  afterAll(async () => {
    await app.close();
    await db.$disconnect();
  });

  it("returns the analysis and records the run", async () => {
    const ticketId = SEED_IDS.duplicateCharge.ticket;

    const res = await app.inject({ method: "POST", url: `/tickets/${ticketId}/analyze` });

    expect(res.statusCode).toBe(200);
    const body = res.json<{ runId: string; output: { text: string } }>();
    expect(body.output).toEqual({ text: MOCK_TEXT });

    const run = await db.run.findUniqueOrThrow({ where: { id: body.runId } });
    expect(run).toMatchObject({
      ticketId,
      model: "mock-model",
      promptVersion: "analyze-ticket@1",
      inputTokens: 42,
      outputTokens: 17,
      toolCalls: [],
      output: { text: MOCK_TEXT },
      error: null,
    });
    expect(run.latencyMs).toBeGreaterThan(0);
  });

  it("returns 404 for an unknown ticket and does not call the model", async () => {
    const callsBefore = model.doGenerateCalls.length;
    const runsBefore = await db.run.count();

    const res = await app.inject({ method: "POST", url: "/tickets/tkt_unknown/analyze" });

    expect(res.statusCode).toBe(404);
    expect(res.json()).toEqual({
      statusCode: 404,
      error: "Not Found",
      message: "Ticket tkt_unknown not found",
    });
    expect(model.doGenerateCalls).toHaveLength(callsBefore);
    expect(await db.run.count()).toBe(runsBefore);
  });
});
