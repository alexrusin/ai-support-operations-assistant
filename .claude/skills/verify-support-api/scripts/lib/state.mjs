// Run state and evidence folders. Everything lives under <repo>/.verify/.
import fs from "node:fs";
import path from "node:path";
import { sh } from "./proc.mjs";

export const REPO = path.resolve(import.meta.dirname, "../../../../..");
const RUNS_DIR = path.join(REPO, ".verify", "runs");
const CURRENT = path.join(REPO, ".verify", "current");

export const DB = { user: "support", password: "support", name: "support_assistant" };
export const CONTAINER_LABEL = "verify-sa-run";

export function newRunId() {
  const stamp = new Date().toISOString().replace(/[-:T]/g, "").slice(0, 14);
  return `${stamp}-${Math.random().toString(36).slice(2, 6)}`;
}

export function runDir(runId) {
  return path.join(RUNS_DIR, runId);
}

export function evidenceDir(runId) {
  const dir = path.join(runDir(runId), "evidence");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

const stateFile = (runId) => path.join(runDir(runId), "state.json");

export function saveState(state) {
  fs.mkdirSync(runDir(state.runId), { recursive: true });
  fs.writeFileSync(stateFile(state.runId), JSON.stringify(state, null, 2));
  fs.writeFileSync(CURRENT, state.runId);
}

function readCurrent() {
  return fs.existsSync(CURRENT) ? fs.readFileSync(CURRENT, "utf8").trim() : undefined;
}

// Returns the state of the given run (or the current run), or undefined.
export function tryLoadState(runId) {
  const id = runId ?? readCurrent();
  if (!id || !fs.existsSync(stateFile(id))) return undefined;
  return JSON.parse(fs.readFileSync(stateFile(id), "utf8"));
}

export function loadState(runId) {
  const state = tryLoadState(runId);
  if (!state) {
    throw new Error("No live verify run. Run `launch` first, or pass --run <id>.");
  }
  return state;
}

export function clearState(runId) {
  fs.rmSync(stateFile(runId), { force: true });
  if (readCurrent() === runId) fs.rmSync(CURRENT, { force: true });
}

export function gitHead() {
  return sh("git", ["rev-parse", "--short", "HEAD"], { cwd: REPO }).stdout.trim();
}

export function writeEvidence(runId, fileName, content) {
  const file = path.join(evidenceDir(runId), fileName);
  fs.writeFileSync(file, content);
  return file;
}
