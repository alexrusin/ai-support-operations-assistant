import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

export const projectDir = process.env.CLAUDE_PROJECT_DIR ?? process.cwd();

export async function readHookInput() {
  let data = "";
  for await (const chunk of process.stdin) data += chunk;
  return data ? JSON.parse(data) : {};
}

// Finds the JS entry point of a package's CLI in node_modules.
function binPath(pkg, name) {
  const dir = join(projectDir, "node_modules", pkg);
  const { bin } = JSON.parse(readFileSync(join(dir, "package.json"), "utf8"));
  return join(dir, typeof bin === "string" ? bin : bin[name]);
}

// Runs a package's CLI with the current node, without npx and without a
// shell. npx adds about 1 second to each call.
export function runTool(pkg, name, args) {
  const result = spawnSync(process.execPath, [binPath(pkg, name), ...args], {
    cwd: projectDir,
    encoding: "utf8",
  });
  return {
    status: result.status,
    ok: result.status === 0,
    output: `${result.stdout ?? ""}${result.stderr ?? ""}${result.error?.message ?? ""}`.trim(),
  };
}

// The check itself broke (bad config, missing file). Show it to the user,
// but do not block Claude: a refactor cannot fix a broken tool.
export function warnWith(message) {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}

// Exit code 2 sends stderr back to Claude as feedback.
export function blockWith(message) {
  process.stderr.write(`${message}\n`);
  process.exit(2);
}
