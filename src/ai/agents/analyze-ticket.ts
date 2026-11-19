import { generateText } from "ai";
import type { AnalysisResult } from "../../domain/runs/record-run.js";
import type { Model } from "../model.js";
import * as prompt from "../prompts/analyze-ticket.js";

const TIMEOUT_MS = 30_000;

// Never throws for a model error. The caller records the failure as a run.
// Latency is wall-clock time for the whole call, the SDK's 2 retries included.
export async function analyzeTicket(
  ticket: { subject: string; body: string },
  model: Model,
): Promise<AnalysisResult> {
  const info = { model: model.modelId, promptVersion: prompt.version };
  const started = performance.now();
  const elapsed = () => Math.round(performance.now() - started);

  try {
    const result = await generateText({
      model,
      system: prompt.system,
      prompt: prompt.buildPrompt(ticket),
      abortSignal: AbortSignal.timeout(TIMEOUT_MS),
    });

    return {
      ...info,
      ok: true,
      text: result.text,
      inputTokens: result.totalUsage.inputTokens ?? null,
      outputTokens: result.totalUsage.outputTokens ?? null,
      latencyMs: elapsed(),
    };
  } catch (error) {
    return {
      ...info,
      ok: false,
      error: error instanceof Error ? error.message : String(error),
      latencyMs: elapsed(),
    };
  }
}
