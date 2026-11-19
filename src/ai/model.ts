import { createOpenAI } from "@ai-sdk/openai";
import type { LanguageModel } from "ai";

// A model object, not a gateway ID string. Runs record its modelId.
export type Model = Exclude<LanguageModel, string>;

export function createOpenAIModel(apiKey: string, modelId: string): Model {
  return createOpenAI({ apiKey })(modelId);
}
