import {
  SpanKind,
  SpanStatusCode,
  context,
  metrics,
  trace,
} from "@opentelemetry/api";
import type { Request, RequestHandler } from "express";
import { requestIdOf } from "../common/request-id.js";
import type { MetricsService } from "./metrics.service.js";
import { SERVICE_NAME } from "./telemetry.js";
import { rememberTraceId } from "./trace-context.js";

/** The route pattern the request matched, or one fixed word: never the raw URL. */
export function routePatternOf(req: Request): string {
  const matched = req.route as { path?: unknown } | undefined;
  const path = matched?.path;
  // Nest's catch-all for a path no route takes (/api*path) is not a pattern anyone chose.
  if (typeof path !== "string" || path.includes("*")) return "unmatched";
  return `${req.baseUrl}${path}`;
}

/**
 * One server span and one duration measurement per request, for OpenTelemetry
 * and for Prometheus. Installed right after the request logger, so the id the
 * logger chose is the one the span records.
 */
export function httpTelemetry(prometheus: MetricsService): RequestHandler {
  const tracer = trace.getTracer(SERVICE_NAME);
  const histogram = metrics
    .getMeter(SERVICE_NAME)
    .createHistogram("http.server.request.duration", {
      unit: "s",
      description:
        "HTTP request duration, by method, route pattern and status.",
    });

  return (req, res, next) => {
    const started = process.hrtime.bigint();
    const span = tracer.startSpan(`HTTP ${req.method}`, {
      kind: SpanKind.SERVER,
      attributes: {
        "http.request.method": req.method,
        "orderpilot.request_id": requestIdOf(req),
      },
    });
    rememberTraceId(req, span.spanContext().traceId);

    // "close" fires once per response, finished or cut off; the route is known by then.
    res.once("close", () => {
      const seconds = Number(process.hrtime.bigint() - started) / 1e9;
      const route = routePatternOf(req);
      span.updateName(`${req.method} ${route}`);
      span.setAttributes({
        "http.route": route,
        "http.response.status_code": res.statusCode,
      });
      if (res.statusCode >= 500) span.setStatus({ code: SpanStatusCode.ERROR });
      span.end();
      histogram.record(seconds, {
        "http.request.method": req.method,
        "http.route": route,
        "http.response.status_code": res.statusCode,
      });
      prometheus.observeRequest(req.method, route, res.statusCode, seconds);
    });

    context.with(trace.setSpan(context.active(), span), next);
  };
}
