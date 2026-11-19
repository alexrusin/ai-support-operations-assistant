import type { Database } from "../../infrastructure/database/client.js";

export interface AnalysisResult {
  model: string;
  promptVersion: string;
  text: string;
  inputTokens: number | null;
  outputTokens: number | null;
  latencyMs: number;
}

export function recordRun(db: Database, ticketId: string, result: AnalysisResult) {
  return db.run.create({
    data: {
      ticketId,
      model: result.model,
      promptVersion: result.promptVersion,
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
      latencyMs: result.latencyMs,
      output: { text: result.text },
    },
  });
}
