import { Injectable } from "@nestjs/common";
import { Histogram, Registry, collectDefaultMetrics } from "prom-client";

/** Seconds, from a few milliseconds to ten seconds: what an API request can take. */
const BUCKETS = [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10];

/**
 * The Prometheus side of the metrics (ADR 0028 says who may read it). Its own
 * registry, not prom-client's global one, so two apps in one test process do
 * not clash. The route label is the route pattern (`/api/v1/orders/:id`),
 * never the raw URL, so the label set stays small and holds no record id.
 */
@Injectable()
export class MetricsService {
  readonly registry = new Registry();
  private readonly httpDuration: Histogram<"method" | "route" | "status">;

  constructor() {
    collectDefaultMetrics({ register: this.registry, prefix: "orderpilot_" });
    this.httpDuration = new Histogram({
      name: "orderpilot_http_request_duration_seconds",
      help: "HTTP request duration in seconds, by method, route pattern and status.",
      labelNames: ["method", "route", "status"],
      buckets: BUCKETS,
      registers: [this.registry],
    });
  }

  observeRequest(
    method: string,
    route: string,
    status: number,
    seconds: number,
  ): void {
    this.httpDuration.observe(
      { method, route, status: String(status) },
      seconds,
    );
  }

  render(): Promise<string> {
    return this.registry.metrics();
  }

  get contentType(): string {
    return this.registry.contentType;
  }
}
