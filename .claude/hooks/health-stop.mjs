// Stop hook. Runs the checks that need the whole project, when Claude
// thinks it is done: type check (tsc), new duplicated code (jscpd), unused
// files, exports and packages (knip), and dependency rules
// (dependency-cruiser).
import { existsSync } from "node:fs";
import { join } from "node:path";
import { blockWith, projectDir, readHookInput, runTool, warnWith } from "./lib.mjs";

const input = await readHookInput();

// Claude is already fixing problems from an earlier block. Let it stop,
// so that the hook cannot keep Claude in a loop.
if (input.stop_hook_active) process.exit(0);

const problems = [];
// Tools that could not run. They warn but do not block: a refactor cannot
// fix a broken tool.
const broken = [];

const types = runTool("typescript", "tsc", ["--noEmit", "--pretty", "false"]);
if (/error TS\d+/.test(types.output)) {
  problems.push(
    "Type errors (tsc). Fix the types. Do not use `any`, `@ts-ignore` or " +
      `\`@ts-expect-error\`:\n${types.output}`,
  );
}

// --changed compares with a baseline built from HEAD, so only clones that
// this session added fail the check. Old duplication does not block.
const dup = runTool("jscpd", "jscpd", [
  "src",
  "--changed",
  "--fail-on-new-clones",
  "--reporters",
  "ai",
  "--no-colors",
]);
if (!dup.ok) problems.push(`New duplicated code (jscpd):\n${dup.output}`);

const unused = runTool("knip", "knip", ["--no-progress"]);
if (!unused.ok) problems.push(`Unused code or packages (knip):\n${unused.output}`);

// Dependency rules (.dependency-cruiser.cjs): no import cycles, layers point
// inward only, no test or dev-only imports in app code. With a
// known-violations file, only new violations fail.
const knownViolations = ".dependency-cruiser-known-violations.json";
const deps = runTool("dependency-cruiser", "depcruise", [
  "src",
  "--config",
  ".dependency-cruiser.cjs",
  "--output-type",
  "err",
  ...(existsSync(join(projectDir, knownViolations)) ? ["--ignore-known", knownViolations] : []),
]);
if (/dependency violations? \(/.test(deps.output) && !deps.ok) {
  problems.push(`Dependency rules (dependency-cruiser):\n${deps.output}`);
} else if (!deps.ok || /\b0 modules\b/.test(deps.output)) {
  // A crash, or nothing checked: with an unsupported TypeScript version
  // dependency-cruiser skips every .ts file and reports no violations.
  broken.push(`dependency-cruiser:\n${deps.output}`);
}

if (problems.length > 0) {
  blockWith(
    "Code health checks failed. Fix these problems before you finish.\n\n" +
      problems.join("\n\n"),
  );
}
if (broken.length > 0) warnWith(`Code health checks could not run:\n${broken.join("\n\n")}`);
