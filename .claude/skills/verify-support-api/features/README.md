# Support assistant API verification map

This folder is the maintained source for verifying the user-facing behavior of the support assistant API. Read this index before you drive the app, then use the matching feature file as the recipe.

## Baseline preconditions

- Docker runs, and `npm install` was done in the repo.
- `.env` has a real `OPENAI_API_KEY`. The server does not start without it, so launch fails.
- Set `V="node .claude/skills/verify-support-api/scripts/verify.mjs"` in Bash, or use the full command in PowerShell.
- Run `$V launch` and wait for the `READY` line.
- Run `$V doctor` and require `DOCTOR OK`. It proves the seed counts `4,7,4,3` and that our PID owns the API port.
- Never drive the dev database on port 5432 or a server that this run did not start.

## Driving conventions

- Start every recipe from a fresh launch unless its preconditions say otherwise.
- Use route paths and seed IDs from `prisma/seed-data.ts` (`SEED_IDS`) as stable handles. Do not use row order or generated values.
- Write HTTP paths without the leading slash in Git Bash (`health`, not `/health`).
- Name each evidence file `<feature-id>--<step>` with `--name`.
- After a recipe that changes rows, reseed with the run's `DATABASE_URL` or launch again. Do not remove proof artifacts.

## Proof and skip reporting

- Capture the request and the response, not only the status code.
- A write needs a read-only second view: a `GET` or a `$V sql` query of the stored rows.
- A startup proof includes the env overrides, the exit code and the server output (`run-server` records all three).
- Record the run ID and commit with every artifact. The helper does this in each `.http.json`.
- Report an unreachable path with the command you tried and the unmet precondition.
- Do not report a skipped entry point as verified through a different path.

## Feature entry contract

Each feature file starts with an H1 title and one paragraph that tells the user-visible behavior. It then has exactly four H2 sections in this order.

1. `Sub-features` lists short IDs with one line for each behavior.
2. `How to get to it (user POV)` lists every user entry point.
3. `Driving it with verify.mjs` starts with `Preconditions:` and has labeled bullets that pair each user action with an exact command and an observable result.
4. `Gotchas` lists traps that can waste or invalidate a verification run.

Keep implementation details out of the map. Name only user paths, stable handles, required state, commands and observable proof.

## Features

- [Health check](./health.md) covers `GET /health`, `HEAD /health`, and the 404 for unknown routes and methods.
- [Server startup](./server-startup.md) covers the listen log and the refusal to start with an invalid environment.
- [Database setup](./database-setup.md) covers migrations from an empty database and a repeated seed.
- [Seed data](./seed-data.md) covers the four edge-case customers, their transactions and tickets, and the policies.
- [Ticket analysis](./ticket-analysis.md) covers `POST /tickets/:id/analyze`, the `runs` row for each model call, the `404` for an unknown ticket and the startup stop without `OPENAI_API_KEY`.

The roadmap (`docs/roadmap.md`) adds customer lookup, policy search, investigation runs and refund approval later. Add one feature file for each new route when it ships.
