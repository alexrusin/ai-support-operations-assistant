import type { Database } from "../../infrastructure/database/client.js";

interface RunInfo {
  model: string;
  promptVersion: string;
  latencyMs: number;
}

export type AnalysisResult =
  | (RunInfo & { ok: true; text: string; inputTokens: number | null; outputTokens: number | null })
  | (RunInfo & { ok: false; error: string });

// Writes one runs row for every model call. A failed call keeps output and
// token counts null and stores the error message.
export function recordRun(db: Database, ticketId: string, result: AnalysisResult) {
  const base = {
    ticketId,
    model: result.model,
    promptVersion: result.promptVersion,
    latencyMs: result.latencyMs,
  };

  if (!result.ok) {
    return db.run.create({ data: { ...base, error: result.error } });
  }

  return db.run.create({
    data: {
      ...base,
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
      output: { text: result.text },
    },
  });
}
