import dotenv from "dotenv";
import { z } from "zod";

dotenv.config({ quiet: true });

// An empty value in .env means "not set".
const optionalString = z.preprocess((v) => (v === "" ? undefined : v), z.string().optional());

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  HOST: z.string().min(1).default("0.0.0.0"),
  LOG_LEVEL: z
    .enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
    .default("info"),
  DATABASE_URL: z.url(),
  // Optional here because tests import this module and have no key.
  // src/server.ts stops when it is missing.
  OPENAI_API_KEY: optionalString,
  AI_MODEL: z.string().min(1).default("gpt-5.4-mini"),
});

export type Config = z.infer<typeof envSchema>;

function loadConfig(): Config {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    console.error("Invalid environment configuration:\n" + z.prettifyError(result.error));
    process.exit(1);
  }
  return result.data;
}

export const config = loadConfig();
