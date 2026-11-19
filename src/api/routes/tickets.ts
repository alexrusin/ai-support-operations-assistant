import type { FastifyPluginAsync } from "fastify";
import { analyzeTicket } from "../../ai/agents/analyze-ticket.js";
import type { Model } from "../../ai/model.js";
import { recordRun } from "../../domain/runs/record-run.js";
import type { Database } from "../../infrastructure/database/client.js";

interface TicketRoutesOptions {
  db: Database;
  model: Model;
}

export const ticketRoutes: FastifyPluginAsync<TicketRoutesOptions> = async (app, { db, model }) => {
  app.post<{ Params: { id: string } }>(
    "/tickets/:id/analyze",
    {
      schema: {
        params: {
          type: "object",
          properties: { id: { type: "string" } },
          required: ["id"],
        },
        response: {
          200: {
            type: "object",
            properties: {
              runId: { type: "string", format: "uuid" },
              output: {
                type: "object",
                properties: { text: { type: "string" } },
                required: ["text"],
              },
            },
            required: ["runId", "output"],
          },
        },
      },
    },
    async (request) => {
      const ticket = await db.ticket.findUniqueOrThrow({ where: { id: request.params.id } });
      const result = await analyzeTicket(ticket, model);
      const run = await recordRun(db, ticket.id, result);
      return { runId: run.id, output: { text: result.text } };
    },
  );
};
