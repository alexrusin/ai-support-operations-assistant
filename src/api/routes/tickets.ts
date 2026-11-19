import type { FastifyPluginAsync } from "fastify";
import { analyzeTicket } from "../../ai/agents/analyze-ticket.js";
import type { Model } from "../../ai/model.js";
import { recordRun } from "../../domain/runs/record-run.js";
import type { Database } from "../../infrastructure/database/client.js";

interface TicketRoutesOptions {
  db: Database;
  model: Model;
}

// Same shape as Fastify's own error body.
const errorBody = {
  type: "object",
  properties: {
    statusCode: { type: "integer" },
    error: { type: "string" },
    message: { type: "string" },
  },
  required: ["statusCode", "error", "message"],
} as const;

const runId = { type: "string", format: "uuid" } as const;

const analyzeSchema = {
  params: {
    type: "object",
    properties: { id: { type: "string" } },
    required: ["id"],
  },
  response: {
    200: {
      type: "object",
      properties: {
        runId,
        output: {
          type: "object",
          properties: { text: { type: "string" } },
          required: ["text"],
        },
      },
      required: ["runId", "output"],
    },
    404: errorBody,
    // runId lets the operator find the failed run.
    502: {
      ...errorBody,
      properties: { ...errorBody.properties, runId },
      required: [...errorBody.required, "runId"],
    },
  },
};

export const ticketRoutes: FastifyPluginAsync<TicketRoutesOptions> = async (app, { db, model }) => {
  app.post<{ Params: { id: string } }>(
    "/tickets/:id/analyze",
    { schema: analyzeSchema },
    async (request, reply) => {
      const { id } = request.params;
      const ticket = await db.ticket.findUnique({ where: { id } });
      if (!ticket) {
        return reply
          .code(404)
          .send({ statusCode: 404, error: "Not Found", message: `Ticket ${id} not found` });
      }

      const result = await analyzeTicket(ticket, model);
      const run = await recordRun(db, ticket.id, result);

      if (!result.ok) {
        // The provider's message stays in the runs row and the log, not in the response.
        request.log.warn({ runId: run.id, error: result.error }, "model call failed");
        return reply.code(502).send({
          statusCode: 502,
          error: "Bad Gateway",
          message: "The model call failed",
          runId: run.id,
        });
      }

      return { runId: run.id, output: { text: result.text } };
    },
  );
};
