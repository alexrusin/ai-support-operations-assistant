// Starts the real server entry point (src/server.ts) through tsx, without watch mode.
import { spawn } from "node:child_process";
import path from "node:path";
import { REPO } from "./state.mjs";

const BIN = path.join(REPO, "node_modules", ".bin");

export function serverEnv(state, overrides = {}) {
  return {
    ...process.env,
    PATH: `${BIN}${path.delimiter}${process.env.PATH}`,
    NODE_ENV: "development",
    HOST: "127.0.0.1",
    LOG_LEVEL: "info",
    PORT: String(state.port),
    DATABASE_URL: state.databaseUrl,
    ...overrides,
  };
}

// stdio is passed to spawn as is: "pipe" to read output, or file descriptors.
export function spawnServer(env, { stdio, detached }) {
  return spawn(process.execPath, ["--import", "tsx", "src/server.ts"], {
    cwd: REPO,
    env,
    stdio,
    detached,
    windowsHide: true,
  });
}

// Env for the Prisma CLI. The explicit DATABASE_URL wins over .env, because
// dotenv does not override variables that are already set.
export function prismaEnv(databaseUrl) {
  return {
    ...process.env,
    PATH: `${BIN}${path.delimiter}${process.env.PATH}`,
    DATABASE_URL: databaseUrl,
  };
}

export const PRISMA_CLI = path.join(REPO, "node_modules", "prisma", "build", "index.js");
