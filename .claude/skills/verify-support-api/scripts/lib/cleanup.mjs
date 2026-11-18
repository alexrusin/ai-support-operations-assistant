// cleanup: stop what one run started. Keeps evidence/ and server.log.
import fs from "node:fs";
import path from "node:path";
import { docker, isOurNode, killTree } from "./proc.mjs";
import { CONTAINER_LABEL, clearState, evidenceDir, runDir, tryLoadState } from "./state.mjs";

export async function cleanup(runId) {
  const state = tryLoadState(runId);
  if (!state) {
    console.log("No live run state. Nothing to clean up. Try `stranded` for lost containers.");
    return;
  }
  if (isOurNode(state.pid)) killTree(state.pid);
  docker(["rm", "-f", "-v", state.container]);
  if (state.logFile && fs.existsSync(state.logFile)) {
    fs.copyFileSync(state.logFile, path.join(evidenceDir(state.runId), "server.log"));
  }
  clearState(state.runId);
  console.log(`CLEANED run=${state.runId}. Evidence kept in ${evidenceDir(state.runId)}`);
}

// Removes verify containers whose run has no state.json (lost by a crashed launch).
export function stranded() {
  const ps = docker(["ps", "-a", "--filter", `label=${CONTAINER_LABEL}`, "--format", `{{.Names}} {{.Label "${CONTAINER_LABEL}"}}`]);
  const rows = ps.stdout.trim().split(/\r?\n/).filter(Boolean);
  for (const row of rows) {
    const [name, runId] = row.split(" ");
    if (fs.existsSync(path.join(runDir(runId), "state.json"))) {
      console.log(`keep ${name} (run ${runId} is live, use cleanup --run ${runId})`);
      continue;
    }
    docker(["rm", "-f", "-v", name]);
    console.log(`removed ${name}`);
  }
  if (rows.length === 0) console.log("No verify containers.");
}
