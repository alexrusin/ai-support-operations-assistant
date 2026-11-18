// launch: own Postgres container on a random port, migrations, seed, then the server.
import fs from "node:fs";
import path from "node:path";
import { cleanup } from "./cleanup.mjs";
import { docker, freePort, getHealth, sh, waitFor } from "./proc.mjs";
import { PRISMA_CLI, prismaEnv, serverEnv, spawnServer } from "./server.mjs";
import { CONTAINER_LABEL, DB, REPO, gitHead, newRunId, runDir, saveState } from "./state.mjs";

// Same image as docker-compose.yml.
const IMAGE = "postgres:18.7-alpine";

function startPostgres(container, runId) {
  const run = docker([
    "run", "-d", "--name", container, "--label", `${CONTAINER_LABEL}=${runId}`,
    "-e", `POSTGRES_USER=${DB.user}`, "-e", `POSTGRES_PASSWORD=${DB.password}`,
    "-e", `POSTGRES_DB=${DB.name}`, "-p", "127.0.0.1::5432", IMAGE,
  ]);
  if (run.code !== 0) throw new Error(`docker run failed:\n${run.out}`);
  const port = docker(["port", container, "5432/tcp"]).stdout.match(/:(\d+)\s*$/m);
  if (!port) throw new Error(`No host port for ${container}`);
  return Number(port[1]);
}

// pg_isready over TCP. The image's init phase listens on a Unix socket only,
// so this passes only after init scripts finish and the final server is up.
function postgresReady(container) {
  const args = ["exec", container, "pg_isready", "-h", "127.0.0.1", "-U", DB.user, "-d", DB.name];
  return docker(args).code === 0;
}

function prisma(args, databaseUrl) {
  console.log(`> prisma ${args.join(" ")}`);
  const r = sh(process.execPath, [PRISMA_CLI, ...args], { cwd: REPO, env: prismaEnv(databaseUrl) });
  if (r.code !== 0) throw new Error(`prisma ${args.join(" ")} failed:\n${r.out}`);
  console.log(r.stdout.trim().split(/\r?\n/).slice(-2).join("\n"));
}

function startServer(state) {
  const fd = fs.openSync(state.logFile, "a");
  const child = spawnServer(serverEnv(state), { stdio: ["ignore", fd, fd], detached: true });
  child.unref();
  fs.closeSync(fd);
  return child.pid;
}

async function serverReady(state) {
  const health = await getHealth(state.baseUrl);
  const log = fs.existsSync(state.logFile) ? fs.readFileSync(state.logFile, "utf8") : "";
  return health.status === 200 && log.includes("Server listening");
}

async function bringUp(state) {
  state.dbPort = startPostgres(state.container, state.runId);
  state.databaseUrl = `postgresql://${DB.user}:${DB.password}@127.0.0.1:${state.dbPort}/${DB.name}`;
  saveState(state);
  await waitFor(() => postgresReady(state.container), { timeoutMs: 60_000, what: "Postgres" });
  prisma(["migrate", "deploy"], state.databaseUrl);
  prisma(["db", "seed"], state.databaseUrl);
  state.port = await freePort();
  state.baseUrl = `http://127.0.0.1:${state.port}`;
  state.logFile = path.join(runDir(state.runId), "server.log");
  state.pid = startServer(state);
  saveState(state);
  await waitFor(() => serverReady(state), { timeoutMs: 30_000, what: "server /health and listen log" });
}

export async function launch() {
  const runId = newRunId();
  const state = { runId, startedAt: new Date().toISOString(), commit: gitHead(), container: `verify-sa-${runId}` };
  saveState(state);
  try {
    await bringUp(state);
  } catch (err) {
    console.error(String(err.message ?? err));
    if (state.logFile && fs.existsSync(state.logFile)) console.error(fs.readFileSync(state.logFile, "utf8").slice(-2000));
    console.error("Launch failed. Cleaning up what this run started.");
    await cleanup(runId);
    process.exitCode = 1;
    return;
  }
  console.log(`READY run=${runId} baseUrl=${state.baseUrl} dbPort=${state.dbPort} pid=${state.pid}`);
}
