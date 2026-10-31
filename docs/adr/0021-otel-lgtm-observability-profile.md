# ADR 0021: Grafana's otel-lgtm as an optional compose profile, with OpenTelemetry in the API

- **Status:** Accepted
- **Date:** 2026-11-01
- **Story:** G-1

## Context

Area 4 (Angelyn) owns monitoring: traces, metrics, logs and the AI's cost. The real dashboards, budgets and alerts are Angelyn's work in Weeks 14 to 16 (Sprints 13 to 15). G-1 gives them something to build on: a way to see traces, metrics and logs from a run, that costs nothing and gets in nobody's way when it is not wanted. Prompt 002 section 7 asks for Grafana's `otel-lgtm` image as an optional compose profile.

## Decision

1. **`grafana/otel-lgtm` at the exact tag `0.38.0`**, as the service `otel-lgtm` in `docker-compose.yml` under the profile `observability`. It is one container holding the OpenTelemetry collector, Tempo (traces), Prometheus (metrics), Loki (logs) and Grafana. A plain `docker compose up -d` does not start it. `docker compose --profile observability up -d otel-lgtm` does.
2. **Ports come from `.env`**: `GRAFANA_PORT` (default 3300, never 3000, which the API may use), `OTLP_GRPC_PORT` and `OTLP_HTTP_PORT`. All three are bound to `127.0.0.1`. The image's default Grafana login (`admin` / `admin`) is acceptable only because the port is not reachable from another machine; a shared host must not publish it.
3. **OpenTelemetry in the API** (`apps/api/src/telemetry/`) makes traces and metrics for every request with `@opentelemetry/api`, `sdk-trace` and `sdk-metrics`, service name `orderpilot-api`. They leave the process over OTLP/HTTP **only when `OTEL_EXPORTER_OTLP_ENDPOINT` is set**. Without it, nothing is sent and no connection is tried. The packages are pinned to exact versions in `apps/api/package.json`.
4. **The trace id is tied to the request id.** The request id stays the caller-facing id (the `X-Request-Id` header and the error envelope's `traceId`); the OpenTelemetry trace id is the one to search for in Grafana. Every log line carries both, and the span carries the request id as `orderpilot.request_id`, so either can be used to find the other.
5. **No automatic instrumentation package.** The base writes one request span and a few metrics by hand. The `auto-instrumentations` bundle patches many modules at start-up and would add load and surprises that nobody asked for. Angelyn may add it when a dashboard needs a span it does not give.

## Consequences

- With no endpoint set, the API behaves exactly as before, apart from a few microseconds to make the trace id for its logs.
- The container image is large. Teammates who do not work on monitoring never pull it.
- The data in `lgtm-data` is a named volume, so traces survive a restart. `docker compose down -v` removes it, like the other volumes.
- The image tag moves only by a pull request that bumps it here and in the compose file.
