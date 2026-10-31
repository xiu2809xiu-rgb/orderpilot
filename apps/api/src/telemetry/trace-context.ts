/**
 * The OpenTelemetry trace id of a request, kept beside its request id. The
 * request id stays the caller-facing id (header, error envelope); the trace id
 * is the one to search for in Grafana. A log line carries both, and the span
 * carries the request id as `orderpilot.request_id`.
 */
const traceIds = new WeakMap<object, string>();

export function rememberTraceId(req: object, traceId: string): void {
  // An all-zero id means no tracer is installed: say nothing rather than a fake id.
  if (/^0+$/.test(traceId)) return;
  traceIds.set(req, traceId);
}

export function traceIdOf(req: object): string | undefined {
  return traceIds.get(req);
}
