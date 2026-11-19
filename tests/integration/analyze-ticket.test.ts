import { setTimeout as sleep } from "node:timers/promises";
import { MockLanguageModelV4 } from "ai/test";
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";
import { SEED_IDS, seedDatabase } from "../../prisma/seed-data.js";
import type { Model } from "../../src/ai/model.js";
import { buildApp } from "../../src/app.js";
import { createPrismaClient, type Database } from "../../src/infrastructure/database/client.js";

const MOCK_TEXT = "The customer was charged two times and wants one refund.";
const ticketId = SEED_IDS.duplicateCharge.ticket;

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

const failingModel = new MockLanguageModelV4({
  modelId: "mock-model",
  doGenerate: async () => {
    await sleep(5);
    throw new Error("provider is down");
  },
});

// Seeds the database and builds an app with the given model for one describe block.
function setupApp(appModel: Model) {
  const ctx = {} as { db: Database; app: FastifyInstance };

  beforeAll(async () => {
    ctx.db = createPrismaClient(inject("databaseUrl"));
    await seedDatabase(ctx.db);
    ctx.app = await buildApp({ db: ctx.db, model: appModel }, { logger: false });
  });

  afterAll(async () => {
    await ctx.app.close();
    await ctx.db.$disconnect();
  });

  return ctx;
}

function analyze(app: FastifyInstance, id: string) {
  return app.inject({ method: "POST", url: `/tickets/${id}/analyze` });
}

describe("POST /tickets/:id/analyze", () => {
  const ctx = setupApp(model);

  it("returns the analysis and records the run", async () => {
    const res = await analyze(ctx.app, ticketId);

    expect(res.statusCode).toBe(200);
    const body = res.json<{ runId: string; output: { text: string } }>();
    expect(body.output).toEqual({ text: MOCK_TEXT });

    const run = await ctx.db.run.findUniqueOrThrow({ where: { id: body.runId } });
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
    const runsBefore = await ctx.db.run.count();

    const res = await analyze(ctx.app, "tkt_unknown");

    expect(res.statusCode).toBe(404);
    expect(res.json()).toEqual({
      statusCode: 404,
      error: "Not Found",
      message: "Ticket tkt_unknown not found",
    });
    expect(model.doGenerateCalls).toHaveLength(callsBefore);
    expect(await ctx.db.run.count()).toBe(runsBefore);
  });
});

describe("POST /tickets/:id/analyze when the model call fails", () => {
  const ctx = setupApp(failingModel);

  it("returns 502 and records the error", async () => {
    const res = await analyze(ctx.app, ticketId);

    expect(res.statusCode).toBe(502);
    const body = res.json<{ runId: string }>();
    expect(body).toEqual({
      statusCode: 502,
      error: "Bad Gateway",
      message: "The model call failed",
      runId: expect.any(String),
    });

    const run = await ctx.db.run.findUniqueOrThrow({ where: { id: body.runId } });
    expect(run).toMatchObject({
      ticketId,
      model: "mock-model",
      promptVersion: "analyze-ticket@1",
      inputTokens: null,
      outputTokens: null,
      output: null,
      error: "provider is down",
    });
    expect(run.latencyMs).toBeGreaterThan(0);
  });
});
