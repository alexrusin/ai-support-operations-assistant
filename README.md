# AI Support Operations Assistant

An assistant that helps a support team investigate customer issues, find the relevant policies, recommend a resolution and run approved actions. The LLM recommends. Plain TypeScript code enforces the business rules.

The plan is in [docs/roadmap.md](docs/roadmap.md).

## Requirements

Node.js 22 or later.

## Setup

```bash
npm install
cp .env.example .env
```

## Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Starts the API with reload on file changes |
| `npm test` | Runs the tests once |
| `npm run typecheck` | Checks types without a build |
| `npm run build` | Compiles to `dist/` |
| `npm start` | Runs the compiled server |

## Endpoints

`GET /health` returns `200` and `{ "status": "ok" }`.

The `http/` folder has one `.http` file per API area. Start the server with `npm run dev`, then send the requests with the VS Code REST Client extension or the JetBrains HTTP client.

## Layout

`src/app.ts` builds the Fastify instance. `src/server.ts` only starts it. Tests call `app.inject()` on the instance, so they do not need a running server.
