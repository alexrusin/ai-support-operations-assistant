// Drive commands. Each one acts on the live run and writes one evidence file.
import { docker, freePort, killTree } from "./proc.mjs";
import { serverEnv, spawnServer } from "./server.mjs";
import { DB, loadState, writeEvidence } from "./state.mjs";

function parseBody(text) {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

// Git Bash turns "/health" into "C:/Program Files/Git/health". Accept "health"
// without the slash, and refuse a path that Git Bash already rewrote.
function normalizePath(urlPath) {
  if (/^[A-Za-z]:[\\/]/.test(urlPath)) {
    throw new Error(`Path "${urlPath}" was rewritten by Git Bash. Pass it without the leading slash, or set MSYS_NO_PATHCONV=1.`);
  }
  return urlPath.startsWith("/") ? urlPath : `/${urlPath}`;
}

export async function http(method, urlPath, { name, body, run }) {
  const state = loadState(run);
  const url = `${state.baseUrl}${normalizePath(urlPath)}`;
  const headers = body ? { "content-type": "application/json" } : {};
  const res = await fetch(url, { method, headers, body });
  const record = {
    evidence: name,
    run: state.runId,
    commit: state.commit,
    at: new Date().toISOString(),
    request: { method, url, body: body ? parseBody(body) : null },
    response: { status: res.status, headers: Object.fromEntries(res.headers), body: parseBody(await res.text()) },
  };
  const file = writeEvidence(state.runId, `${name}.http.json`, JSON.stringify(record, null, 2));
  console.log(JSON.stringify(record.response, null, 2));
  console.log(`EVIDENCE ${file}`);
}

export function sql(query, { name, run }) {
  const state = loadState(run);
  const r = docker(["exec", state.container, "psql", "-U", DB.user, "-d", DB.name, "-A", "-F", " | ", "-P", "footer=off", "-c", query]);
  const text = `-- run ${state.runId} at ${new Date().toISOString()}\n-- ${query}\n${r.out}`;
  const file = writeEvidence(state.runId, `${name}.sql.txt`, text);
  console.log(r.out.trim());
  console.log(`EVIDENCE ${file}`);
  if (r.code !== 0) process.exitCode = 1;
}

function parseEnv(pairs) {
  return Object.fromEntries(pairs.map((p) => [p.slice(0, p.indexOf("=")), p.slice(p.indexOf("=") + 1)]));
}

function collect(child, timeoutMs) {
  return new Promise((resolve) => {
    let output = "";
    const append = (chunk) => (output += chunk);
    child.stdout.on("data", append);
    child.stderr.on("data", append);
    const timer = setTimeout(() => resolve({ timedOut: true, exitCode: null, output }), timeoutMs);
    child.on("exit", (code) => {
      clearTimeout(timer);
      resolve({ timedOut: false, exitCode: code, output });
    });
  });
}

// Starts a second, short-lived server with env overrides and records how it ends.
export async function runServer({ name, env = [], timeout, run }) {
  const state = loadState(run);
  const overrides = parseEnv(env);
  const port = await freePort();
  const child = spawnServer(serverEnv({ ...state, port }, overrides), { stdio: ["ignore", "pipe", "pipe"], detached: false });
  const result = await collect(child, Number(timeout ?? 15_000));
  if (result.timedOut) killTree(child.pid);
  const record = { evidence: name, run: state.runId, at: new Date().toISOString(), port, envOverrides: overrides, ...result };
  const file = writeEvidence(state.runId, `${name}.server.json`, JSON.stringify(record, null, 2));
  console.log(`exitCode=${result.exitCode} timedOut=${result.timedOut}\n${result.output.trim()}`);
  console.log(`EVIDENCE ${file}`);
}
