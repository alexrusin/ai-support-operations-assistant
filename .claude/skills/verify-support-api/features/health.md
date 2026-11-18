# Health check

The health check lets an operator or a load balancer see that the API process is up and answers HTTP. It does not touch the database.

## Sub-features

- `health-ok` returns `200` with body `{"status":"ok"}` and JSON content type.
- `health-head` answers `HEAD /health` with `200` and no body.
- `health-unknown-route` returns a JSON `404` for a path that does not exist.
- `health-wrong-method` returns a JSON `404` for `POST /health`.

## How to get to it (user POV)

- Send `GET /health` to the running server, as in `http/health.http`.
- Send `HEAD /health`, as some load balancers do.

## Driving it with verify.mjs

Preconditions:

- `$V doctor` reports `DOCTOR OK`.

- **Get health.** Run `$V http GET health --name health--ok`. The status is `200`, `content-type` is `application/json; charset=utf-8`, and the body is `{"status":"ok"}`.
- **Head health.** Run `$V http HEAD health --name health--head`. The status is `200` and the body is empty.
- **Unknown route.** Run `$V http GET nope --name health--unknown-route`. The status is `404` and the body is `{"message":"Route GET:/nope not found","error":"Not Found","statusCode":404}`.
- **Wrong method.** Run `$V http POST health --name health--wrong-method`. The status is `404` and the message is `Route POST:/health not found`.
- **Request log.** Run `$V cleanup`, then search `evidence/server.log` for `"url":"/health"`. There is one `incoming request` and one `request completed` line per request, with the same `reqId`.

## Gotchas

- In Git Bash, `/health` becomes `C:/Program Files/Git/health`. Write `health` without the slash.
- A `200` from `/health` does not prove the database works. Doctor checks the seed counts for that.
- `server.log` is in `evidence/` only after cleanup. Before cleanup, read `logFile` from `$V info`.
