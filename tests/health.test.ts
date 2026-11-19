import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";
import { MockLanguageModelV4 } from "ai/test";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/app.js";
import { createPrismaClient, type Database } from "../src/infrastructure/database/client.js";

describe("GET /health", () => {
  let db: Database;
  let app: FastifyInstance;

  beforeAll(async () => {
    db = createPrismaClient(inject("databaseUrl"));
    app = await buildApp({ db, model: new MockLanguageModelV4() }, { logger: false });
  });

  afterAll(async () => {
    await app.close();
    await db.$disconnect();
  });

  it("returns 200 and status ok", async () => {
    const res = await app.inject({ method: "GET", url: "/health" });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: "ok" });
  });
});
