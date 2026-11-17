// PostToolUse hook. Lints the one file that Claude edited or wrote.
// The type check is in the Stop hook: during a change to many files, the
// types are often broken until the last edit, so a check here blocks too early.
import { blockWith, readHookInput, runTool, warnWith } from "./lib.mjs";

const input = await readHookInput();
const file = input.tool_input?.file_path ?? "";

if (!/\.(c|m)?(j|t)sx?$/.test(file)) process.exit(0);

const lint = runTool("eslint", "eslint", ["--no-warn-ignored", file]);

// ESLint exits with 1 when it finds problems, and with 2 when it crashes.
if (lint.status === 1) {
  blockWith(
    `Code health check failed for ${file}.\n` +
      "Refactor the code to fix these problems. " +
      "Do not disable the rules or raise the limits.\n\n" +
      lint.output,
  );
}
if (!lint.ok) warnWith(`Code health check could not run:\n${lint.output}`);
