# ADR 0009: The observability baseline

- **Status:** Accepted
- **Date:** 2026-10-31
- **Story:** P-8

## Context

When a person sees "something went wrong" on a screen, we need to find the exact request in the logs in seconds. When the stack is deployed (P-24), the host and the orchestrator need to know if the API is alive and ready. Metrics and traces come later (G-1); this is what must exist from the first route.

## Decision

1. **Logs are JSON, one object per line, through pino.** `pino-http` writes exactly one line per request when the response finishes, at `info`, `warn` for 4xx and `error` for 5xx. Everything Nest and our own code log goes through the same pino instance (`AppLogger`), to stdout, where Docker and the host collect it.
2. **The request id is the correlation id.** The caller's `X-Request-Id` header (the name comes from `HEADERS.requestId` in `@orderpilot/shared`) is the request id when it is 1 to 128 characters of letters, digits and `._:-`; otherwise the API makes a UUID. The id is:
   - returned on the response as `X-Request-Id`;
   - in the request's log line as `requestId`, and in every log line written while the request is handled (an async-local logger carries it into services and repositories);
   - the `traceId` in the error envelope, so the web app can show it and a person can quote it.
3. **The request logger is installed first, at the Express level**, so that it sees every request, including the ones no route takes and the ones the rate limiter refuses.
4. **Secrets never reach a log.** `cookie`, `authorization`, `x-csrf-token` (request) and `set-cookie` (response) are redacted by pino (`[redacted]`). Request and response bodies are not logged. A test sends fake secrets and searches the output.
5. **A bug is logged, not shown.** The caller gets a generic message and the trace id; the error and its stack are logged once, against the same id.
6. **Three health endpoints**, outside `/api` and unversioned:
   - `/health/live`: the process is up. It checks nothing else, so a slow database never makes an orchestrator restart a healthy process;
   - `/health/ready`: 200 when every registered check is up, 503 when one is down. The body lists each check by name, status and duration, never the reason;
   - `/health`: the status and the name and status of each check, always 200 (for people and dashboards). P-9 cut it down from the build, `APP_ENV`, uptime and timings: anonymous callers need to know whether the API is up, not which version and environment to attack. The version stays in Swagger and, from P-10, behind sign-in.
     They are not rate limited, so a probe cannot be locked out.
7. **The log level comes from configuration** (`LOG_LEVEL`). There is no pretty printer in the app: pipe the output through one on your own machine if you want colour.

## Consequences

- To follow one request: take the `traceId` from the screen or the `X-Request-Id` from the browser, and search the logs for `requestId`.
- The baseline has no metrics, traces or request-body logging. G-1 adds OpenTelemetry, `/metrics` and the usage analytics on top of the same ids.
- Log volume is one line per request. If it ever matters, sample the probes first.
