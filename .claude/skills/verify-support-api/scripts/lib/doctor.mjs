// doctor: read-only checks that the current run is worth driving.
import { docker, getHealth, isOurNode, listenerPid } from "./proc.mjs";
import { DB, gitHead, loadState } from "./state.mjs";

// Row counts that prisma/seed-data.ts loads.
const SEED_COUNTS = { customers: 4, transactions: 7, tickets: 4, policies: 3 };

function containerCheck(state) {
  const r = docker(["inspect", "-f", "{{.State.Running}}", state.container]);
  return { name: "postgres container running", ok: r.stdout.trim() === "true", detail: state.container };
}

function seedCheck(state) {
  const query = Object.keys(SEED_COUNTS).map((t) => `(select count(*) from ${t})`).join(",");
  const r = docker(["exec", state.container, "psql", "-U", DB.user, "-d", DB.name, "-tA", "-F", ",", "-c", `select ${query}`]);
  const got = r.stdout.trim();
  const want = Object.values(SEED_COUNTS).join(",");
  return { name: "seed row counts", ok: got === want, detail: `got ${got || r.out.trim()}, want ${want} (${Object.keys(SEED_COUNTS).join(",")})` };
}

function portCheck(state) {
  const owner = listenerPid(state.port);
  return { name: "port owned by our server", ok: owner === state.pid, detail: `port ${state.port} listener pid ${owner ?? "none"}, ours ${state.pid}` };
}

async function healthCheck(state) {
  const h = await getHealth(state.baseUrl);
  return { name: "GET /health", ok: h.status === 200 && h.body === '{"status":"ok"}', detail: `${h.status} ${h.body}` };
}

function commitCheck(state) {
  const head = gitHead();
  return { name: "build matches HEAD", ok: true, warn: head !== state.commit, detail: `launched at ${state.commit}, HEAD is ${head}` };
}

function checkTag(check) {
  if (!check.ok) return "FAIL";
  return check.warn ? "WARN" : "OK  ";
}

export async function doctor(runId) {
  const state = loadState(runId);
  const checks = [
    containerCheck(state),
    seedCheck(state),
    { name: "server process alive", ok: isOurNode(state.pid), detail: `pid ${state.pid}` },
    portCheck(state),
    await healthCheck(state),
    commitCheck(state),
  ];
  for (const c of checks) console.log(`${checkTag(c)} ${c.name}: ${c.detail}`);
  const failed = checks.filter((c) => !c.ok).length;
  console.log(failed ? `DOCTOR FAIL run=${state.runId}` : `DOCTOR OK run=${state.runId} baseUrl=${state.baseUrl}`);
  if (failed) process.exitCode = 1;
}
