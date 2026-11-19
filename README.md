# AI Support Operations Assistant

An assistant that helps a support team investigate customer issues, find the relevant policies, recommend a resolution and run approved actions. The LLM recommends. Plain TypeScript code enforces the business rules.

The plan is in [docs/roadmap.md](docs/roadmap.md).

## Requirements

Node.js 22.18 or later, and Docker with Docker Compose.

## Setup

```bash
npm install
cp .env.example .env
npm run db:up
npx prisma migrate deploy
npm run db:seed
```

Put your OpenAI key in `OPENAI_API_KEY` in `.env`. The server does not start without it.

`npm install` also runs `prisma generate`. The Prisma client goes to `src/generated/prisma`, which is not in Git.

The database is PostgreSQL 18 in Docker Compose. Only the app and the seed script use it.

The tests do not use that database. `npm test` starts a new Postgres container with Testcontainers, applies the migrations, runs the tests and removes the container. Docker must run, but `.env` and `npm run db:up` are not necessary. The first run pulls the image, so it is slower.

## Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Starts the API with reload on file changes |
| `npm test` | Runs the tests once, on a temporary Postgres container |
| `npm run test:live` | Runs the live tests, which call the real OpenAI model. Skipped without a key |
| `npm run typecheck` | Checks types without a build |
| `npm run build` | Compiles to `dist/` |
| `npm start` | Runs the compiled server |
| `npm run db:up` | Starts PostgreSQL and waits until it is healthy |
| `npm run db:down` | Stops PostgreSQL. The data stays in the `pgdata` volume |
| `npm run db:migrate` | Makes and applies a migration after a schema change |
| `npm run db:seed` | Deletes all rows and loads the seed data again |
| `npm run db:reset` | Drops the database, applies all migrations and seeds |
| `npm run db:studio` | Opens Prisma Studio to look at the data |

## CI

`.github/workflows/ci.yml` runs on each pull request and on each push to `main`. It runs lint, typecheck, the three code health checks, the tests and the build. The tests use the Docker on the GitHub runner for Testcontainers.

## Endpoints

`GET /health` returns `200` and `{ "status": "ok" }`.

`POST /tickets/:id/analyze` sends the ticket subject and body to the model and waits for the answer. It has no request body.

| Status | Body | When |
| --- | --- | --- |
| `200` | `{ "runId": "<uuid>", "output": { "text": "..." } }` | The model answered |
| `404` | `{ "statusCode": 404, "error": "Not Found", "message": "Ticket <id> not found" }` | No ticket has that ID. The model is not called |
| `502` | `{ "statusCode": 502, "error": "Bad Gateway", "message": "The model call failed", "runId": "<uuid>" }` | The model call failed after 2 retries or the 30 second timeout |

Try it with `tkt_duplicate` from the seed data. One call to the default model costs less than one cent.

The `http/` folder has one `.http` file per API area. Start the server with `npm run dev`, then send the requests with the VS Code REST Client extension or the JetBrains HTTP client.

## Layout

`src/app.ts` builds the Fastify instance. `src/server.ts` only starts it. Tests call `app.inject()` on the instance, so they do not need a running server.

## Seed data

`prisma/seed-data.ts` has fixed IDs in `SEED_IDS`, so tests and evals can refer to the same rows. It has one customer for each edge case:

| Customer | Case |
| --- | --- |
| `cus_duplicate` | Two $49.00 charges 2 minutes apart. A real duplicate charge |
| `cus_refunded` | A $49.00 charge that is already refunded |
| `cus_above_limit` | A $1,200.00 charge. The refund policy limit is $500.00 |
| `cus_no_duplicate` | Two $49.00 renewals one month apart. Not a duplicate |

Money is in integer cents. Dates are relative to the seed time, so the 30-day refund window stays correct.

## Environment

`.env.example` lists every variable. The AI variables are:

| Variable | Default | What it does |
| --- | --- | --- |
| `OPENAI_API_KEY` | none | OpenAI key. The server exits at startup when it is empty. Tests do not need it |
| `AI_MODEL` | `gpt-5.4-mini` | OpenAI model ID for ticket analysis |

## Runs

Every model call writes one row to the `runs` table, also when the call fails. A `404` for an unknown ticket writes no row.

| Column | What it holds |
| --- | --- |
| `id` | UUID. The `runId` in the response |
| `ticket_id` | The analyzed ticket |
| `model` | The model ID that ran |
| `prompt_version` | The prompt version, for example `analyze-ticket@1` |
| `input_tokens`, `output_tokens` | Token counts from the provider. Null when the call failed |
| `latency_ms` | Wall-clock time of the whole call, retries included |
| `tool_calls` | Empty `[]` until the assistant has tools |
| `output` | `{ "text": "..." }`. Null when the call failed |
| `error` | The error message when the call failed |
| `created_at` | When the row was written |

To see the last runs:

```sql
select id, ticket_id, model, input_tokens, output_tokens, latency_ms, error
from runs order by created_at desc limit 10;
```
