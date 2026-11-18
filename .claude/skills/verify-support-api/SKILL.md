---
name: verify-support-api
description: Launch and drive the AI Support Operations Assistant HTTP API (Fastify + PostgreSQL) against its own throwaway Postgres container, then capture HTTP, SQL and server-log evidence. Use when you must prove that an API route, the server startup, the migrations or the seed data work in the real running app, not only in Vitest.
---

# Verify the support assistant API

The app is a Fastify HTTP API in `src/server.ts` with PostgreSQL behind it. There is no UI. A user (an operator, or later the assistant) touches it through HTTP routes, the server start command and the database scripts. The feature map in [features/README.md](features/README.md) lists what to drive. Read it before you drive anything.

All steps use one helper. Run it from the repo root with Node 22.18 or later:

```bash
node .claude/skills/verify-support-api/scripts/verify.mjs <command>
```

In Bash, set `V="node .claude/skills/verify-support-api/scripts/verify.mjs"` and use `$V`. In PowerShell, use the full command. Run it with no command to see usage.

## Why a separate database

`docker-compose.yml` binds the dev database to host port 5432 and keeps its data in the `pgdata` volume. The seed script deletes all rows. If you seed or drive that database, you destroy the user's dev data. So this skill never uses `npm run db:up`, `docker compose` or the `DATABASE_URL` in `.env`. Each run starts its own container from the same image on a random `127.0.0.1` port. The helper passes `DATABASE_URL` in the environment, and dotenv does not override a variable that is already set, so `.env` has no effect.

Two runs can live side by side. Each has its own container, DB port and API port. `.verify/current` points to the newest run. To drive an older run, pass `--run <id>` to every command.

## Launch

```bash
node .claude/skills/verify-support-api/scripts/verify.mjs launch
```

It does these steps, in this order:

1. `docker run` of `postgres:18.7-alpine`, named `verify-sa-<runId>`, label `verify-sa-run=<runId>`, port `127.0.0.1::5432`.
2. Waits for `pg_isready -h 127.0.0.1` inside the container. The image's init phase listens on a Unix socket only, so a TCP check passes only when the final server is up.
3. `prisma migrate deploy`, then `prisma db seed`, against the run's database.
4. Starts `node --import tsx src/server.ts` (no watch) with `HOST=127.0.0.1`, a free `PORT`, `LOG_LEVEL=info`. Output goes to `.verify/runs/<runId>/server.log`.
5. Waits until `GET /health` returns 200 and `server.log` has `Server listening`.

Ready means the last line is `READY run=<id> baseUrl=http://127.0.0.1:<port> dbPort=<port> pid=<pid>`. A cold launch takes about 20 seconds. If a step fails, launch prints the error and the log tail, removes what it started and exits with 1.

Preconditions: Docker runs, and `npm install` was done (it makes `src/generated/prisma`). Launch does not need `.env`.

The server loads the source one time at start. After you edit anything in `src/` or `prisma/`, run cleanup and launch again. Doctor warns when HEAD moved since launch, but it cannot see uncommitted edits.

## Doctor

```bash
node .claude/skills/verify-support-api/scripts/verify.mjs doctor
```

Read only. Run it before you drive, and again when anything looks wrong. It checks: the container runs, the seed row counts are `4,7,4,3` (customers, transactions, tickets, policies), the server PID is a live Node process, that PID owns the API port, `GET /health` returns `200 {"status":"ok"}`, and HEAD equals the launch commit (WARN only). The last line is `DOCTOR OK` or `DOCTOR FAIL`, and a failure exits with 1. On `DOCTOR FAIL`, do not drive. Run cleanup and launch again.

`$V info` prints the run state: `baseUrl`, `databaseUrl`, `dbPort`, `pid`, `container`, `logFile`, `commit`.

## Drive

Every drive command writes one evidence file. `--name` is required. Use `<feature-id>--<step>`, for example `health--ok`.

```bash
# HTTP request to the run's API. Records request, status, headers and body.
$V http GET health --name health--ok
$V http POST some/route --body '{"key":"value"}' --name feature--step

# SQL in the run's database through psql in the container.
$V sql "select id, status from transactions order by id" --name seed-data--transactions

# A second, short-lived server with env overrides. Records exit code and output.
$V run-server --name server-startup--bad-port --env PORT=99999 --timeout 15000
```

Write the HTTP path without the leading slash when you use Git Bash. Git Bash rewrites `/health` to `C:/Program Files/Git/health`, and the helper refuses that path. PowerShell, or `MSYS_NO_PATHCONV=1`, also works with the slash.

`run-server` uses the run's `DATABASE_URL` and a new free port unless you override them. If the server is still up at `--timeout`, the helper kills it and records `timedOut: true`.

To run a repo script against the run's database, take `databaseUrl` from `$V info` and set it for that one command, for example `DATABASE_URL=<databaseUrl> npm run db:seed`. Never run a database script without that override.

## Evidence

Evidence goes to `.verify/runs/<runId>/evidence/`. The folder is in `.gitignore`. Files:

- `<name>.http.json` has the request, status, headers, body, run ID and commit.
- `<name>.sql.txt` has the query and the psql output.
- `<name>.server.json` has the env overrides, exit code, timeout flag and server output.
- `server.log` is copied in at cleanup. It has one pino line per request, with `reqId`, URL and status code.

Proof rules:

- Drive the real user path: an HTTP request to the running server, the real start command, the real npm scripts. `app.inject()` and the Vitest suite are not proof for this skill.
- Capture the action and the result. For a write, also capture a read-only second view: a `GET` or a `sql` query of the stored rows.
- Check side effects, not only the response. A route that writes must have the rows in the database. A route that logs must have the line in `server.log`.
- Mocks are allowed only at a boundary the app already isolates. Today there is none, so use no mocks.
- When a feature file lists more than one entry point, drive each one. A skipped entry point is reported as skipped, with the reason, not as verified.

## Cleanup

```bash
node .claude/skills/verify-support-api/scripts/verify.mjs cleanup
```

It kills the server process tree it started (only if that PID is still a Node process), removes the run's container and its anonymous volume, copies `server.log` into `evidence/`, and deletes `state.json`. It keeps `.verify/runs/<runId>/evidence/`. It never touches the dev container `ai-support-operations-assistant-db-1`, and it never kills by process name.

Run cleanup after each run, and after each failed attempt. If a launch crashed before it saved state, `$V stranded` removes `verify-sa-*` containers whose run has no `state.json` and lists the live ones.

## Helpers

All helper code is in `scripts/`. `verify.mjs` is the CLI. `lib/launch.mjs`, `lib/doctor.mjs`, `lib/evidence.mjs` and `lib/cleanup.mjs` hold the commands. `lib/proc.mjs` and `lib/state.mjs` hold the process and state utilities. The repo's ESLint code health rules and knip check these files. `knip.json` lists `verify.mjs` as an entry.
