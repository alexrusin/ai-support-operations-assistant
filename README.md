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

`npm install` also runs `prisma generate`. The Prisma client goes to `src/generated/prisma`, which is not in Git.

The database is PostgreSQL 18 in Docker Compose. Only the app and the seed script use it.

The tests do not use that database. `npm test` starts a new Postgres container with Testcontainers, applies the migrations, runs the tests and removes the container. Docker must run, but `.env` and `npm run db:up` are not necessary. The first run pulls the image, so it is slower.

## Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Starts the API with reload on file changes |
| `npm test` | Runs the tests once, on a temporary Postgres container |
| `npm run typecheck` | Checks types without a build |
| `npm run build` | Compiles to `dist/` |
| `npm start` | Runs the compiled server |
| `npm run db:up` | Starts PostgreSQL and waits until it is healthy |
| `npm run db:down` | Stops PostgreSQL. The data stays in the `pgdata` volume |
| `npm run db:migrate` | Makes and applies a migration after a schema change |
| `npm run db:seed` | Deletes all rows and loads the seed data again |
| `npm run db:reset` | Drops the database, applies all migrations and seeds |
| `npm run db:studio` | Opens Prisma Studio to look at the data |

## Endpoints

`GET /health` returns `200` and `{ "status": "ok" }`.

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
