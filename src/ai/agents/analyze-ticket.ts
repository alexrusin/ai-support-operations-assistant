import { generateText } from "ai";
import type { AnalysisResult } from "../../domain/runs/record-run.js";
import type { Model } from "../model.js";
import * as prompt from "../prompts/analyze-ticket.js";

const TIMEOUT_MS = 30_000;

// Latency is wall-clock time for the whole call, retries included.
export async function analyzeTicket(
  ticket: { subject: string; body: string },
  model: Model,
): Promise<AnalysisResult> {
  const started = performance.now();
  const result = await generateText({
    model,
    system: prompt.system,
    prompt: prompt.buildPrompt(ticket),
    abortSignal: AbortSignal.timeout(TIMEOUT_MS),
  });

  return {
    model: model.modelId,
    promptVersion: prompt.version,
    text: result.text,
    inputTokens: result.totalUsage.inputTokens ?? null,
    outputTokens: result.totalUsage.outputTokens ?? null,
    latencyMs: Math.round(performance.now() - started),
  };
}
