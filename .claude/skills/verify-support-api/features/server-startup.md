# Server startup

The server reads its settings from the environment, refuses to start when one is invalid, and logs the address when it listens.

## Sub-features

- `startup-listen` logs `Server listening at http://127.0.0.1:<port>` and serves on that port.
- `startup-bad-database-url` exits with code `1` and names `DATABASE_URL` when it is not a URL.
- `startup-bad-port` exits with code `1` and names `PORT` when it is out of range.
- `startup-bad-log-level` exits with code `1` and names `LOG_LEVEL` when it is not a pino level.

## How to get to it (user POV)

- Run `npm run dev` (tsx watch) or `npm start` (compiled `dist/`) with the environment set or `.env` present.

## Driving it with verify.mjs

Preconditions:

- `$V doctor` reports `DOCTOR OK`. The `run-server` command starts a second server next to the run's server and needs the run's database URL.

- **Listen log.** Run `$V run-server --name server-startup--listen --timeout 8000`. The record has `timedOut: true`, and the output has `Server listening at http://127.0.0.1:<port>` with the `port` from the record.
- **Bad database URL.** Run `$V run-server --name server-startup--bad-database-url --env DATABASE_URL=not-a-url`. `exitCode` is `1` and the output has `Invalid environment configuration:` and `at DATABASE_URL`.
- **Bad port.** Run `$V run-server --name server-startup--bad-port --env PORT=99999`. `exitCode` is `1` and the output has `at PORT`.
- **Bad log level.** Run `$V run-server --name server-startup--bad-log-level --env LOG_LEVEL=loud`. `exitCode` is `1` and the output has `at LOG_LEVEL`.

## Gotchas

- `run-server` runs `src/server.ts` through tsx, the same entry as `npm run dev` without watch. It does not prove the `npm start` build. To prove `npm start`, run `npm run build` first and record that gap in the report.
- The server does not connect to the database at start. A valid but unreachable `DATABASE_URL` starts fine. Do not use startup as database proof.
- An empty value (`--env DATABASE_URL=`) is not the same as a missing variable. Both fail, with different messages.
- On Windows, the helper kills a timed-out server. The `SIGINT` and `SIGTERM` shutdown log (`shutting down`) is not reachable this way. Report it as skipped on Windows.
