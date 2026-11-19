# Ticket analysis

A support operator sends a ticket ID and gets a short analysis from the OpenAI model in the same HTTP response. Every model call writes one `runs` row with the model ID, prompt version, token counts, latency and output, also when the call fails. An unknown ticket returns `404` and writes no row.

## Sub-features

- `analysis-ok` returns `200` with `{ runId, output: { text } }` for a seed ticket.
- `analysis-run-row` writes a `runs` row for that `runId` with real token counts, the `AI_MODEL` ID, `analyze-ticket@1`, a latency above 0 and a null `error`.
- `analysis-unknown-ticket` returns `404` with `Ticket <id> not found` and writes no `runs` row.
- `analysis-missing-key` stops the server at startup with exit code `1` and names `OPENAI_API_KEY` when the key is empty.

## How to get to it (user POV)

- Send `POST /tickets/:id/analyze` to the running server, as in `http/tickets.http`.
- Start the server without `OPENAI_API_KEY` (`npm run dev` or `npm start`).

## Driving it with verify.mjs

Preconditions:

- `.env` has a real `OPENAI_API_KEY`. Without it, launch fails, because the server exits at startup. The launch output then has `OPENAI_API_KEY is not set`. Report that as the missing-key proof and report the other steps as skipped.
- `$V doctor` reports `DOCTOR OK`.

- **Analyze a seed ticket.** Run `$V http POST tickets/tkt_duplicate/analyze --name ticket-analysis--ok`. The status is `200`, `runId` is a UUID, and `output.text` is not empty. The call takes a few seconds.
- **Run row.** Run `$V sql "select id, ticket_id, model, prompt_version, input_tokens, output_tokens, latency_ms, tool_calls, error, output is not null as has_output from runs order by created_at" --name ticket-analysis--run-row`. There is one row. Its `id` is the `runId` from the first step, `ticket_id` is `tkt_duplicate`, `model` is the `AI_MODEL` value (default `gpt-5.4-mini`), `prompt_version` is `analyze-ticket@1`, both token counts are above 0, `tool_calls` is `[]`, `error` is empty and `has_output` is `t`.
- **Unknown ticket.** Run `$V http POST tickets/tkt_unknown/analyze --name ticket-analysis--unknown-ticket`. The status is `404` and the body is `{"statusCode":404,"error":"Not Found","message":"Ticket tkt_unknown not found"}`. Run the run-row query again with `--name ticket-analysis--no-new-row`. The row count did not change.
- **Missing key.** Run `$V run-server --name ticket-analysis--missing-key --env OPENAI_API_KEY=`. `exitCode` is `1` and the output has `OPENAI_API_KEY is not set`.

## Gotchas

- The analyze steps call the paid OpenAI API. One call to the default model costs less than one cent. Do not loop them.
- `--env OPENAI_API_KEY=` sets an empty value, and the config treats empty as not set. dotenv does not fill a variable that is already set, so `.env` cannot override it.
- The `502` for a failed model call is not reachable here. `$V http` sends requests only to the launched server, and that server has a working key. Report `502` as skipped. The Vitest suite covers it with a mock model.
- `output.text` changes on each call. Check that it is not empty, not its words.
