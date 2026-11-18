#!/usr/bin/env node
// Verification harness for the support assistant API. See ../SKILL.md.
import { parseArgs } from "node:util";
import { cleanup, stranded } from "./lib/cleanup.mjs";
import { doctor } from "./lib/doctor.mjs";
import { http, runServer, sql } from "./lib/evidence.mjs";
import { launch } from "./lib/launch.mjs";
import { loadState } from "./lib/state.mjs";

const USAGE = `usage: node .claude/skills/verify-support-api/scripts/verify.mjs <command>
  launch                                   start Postgres + migrate + seed + server
  doctor     [--run ID]                    read-only health of the run
  http       METHOD PATH --name N [--body JSON] [--run ID]
  sql        "QUERY" --name N [--run ID]
  run-server --name N [--env K=V ...] [--timeout MS] [--run ID]
  cleanup    [--run ID]                    stop the run, keep evidence
  info       [--run ID]                    print run state (baseUrl, databaseUrl, pid)
  stranded                                 remove lost verify containers`;

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: {
    run: { type: "string" },
    name: { type: "string" },
    body: { type: "string" },
    env: { type: "string", multiple: true },
    timeout: { type: "string" },
  },
});

const [command, ...rest] = positionals;

function requireName() {
  if (!values.name) throw new Error("--name is required. Use <feature-id>--<step>, for example health--ok.");
}

const commands = {
  launch: () => launch(),
  doctor: () => doctor(values.run),
  cleanup: () => cleanup(values.run),
  stranded: () => stranded(),
  info: () => console.log(JSON.stringify(loadState(values.run), null, 2)),
  http: () => (requireName(), http(rest[0].toUpperCase(), rest[1], values)),
  sql: () => (requireName(), sql(rest[0], values)),
  "run-server": () => (requireName(), runServer(values)),
};

if (!commands[command]) {
  console.log(USAGE);
  process.exit(command ? 1 : 0);
}

try {
  await commands[command]();
} catch (err) {
  console.error(`ERROR ${err.message ?? err}`);
  process.exitCode = 1;
}
