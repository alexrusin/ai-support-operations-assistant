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
          404: {
            type: "object",
            properties: {
              statusCode: { type: "integer" },
              error: { type: "string" },
              message: { type: "string" },
            },
            required: ["statusCode", "error", "message"],
          },
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params;
      const ticket = await db.ticket.findUnique({ where: { id } });
      if (!ticket) {
        // Same body shape as Fastify's own 404 for unknown routes.
        return reply
          .code(404)
          .send({ statusCode: 404, error: "Not Found", message: `Ticket ${id} not found` });
      }

      const result = await analyzeTicket(ticket, model);
      const run = await recordRun(db, ticket.id, result);
      return { runId: run.id, output: { text: result.text } };
    },
  );
};
