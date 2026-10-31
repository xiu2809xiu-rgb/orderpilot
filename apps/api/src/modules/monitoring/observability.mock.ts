import {
  type ClickstreamSummary,
  type ObservabilityReport,
  type RecentTrace,
  type ServiceHealth,
} from "@orderpilot/shared";
import { SeededRandom } from "@orderpilot/synthetic-data";

/**
 * Made-up numbers for the observability and clickstream screens. Angelyn
 * replaces them with queries over Grafana's data and the ClickstreamEvent
 * table (Sprints 13 to 15). Seeded, so the screens look the same every time.
 */
const SEED = 4_011;

const SERVICES = ["orderpilot-api", "orderpilot-worker", "postgres", "redis"];

const TRACE_ROUTES = [
  "/api/v1/orders",
  "/api/v1/orders/:id",
  "/api/v1/documents",
  "/api/v1/governance/matrix",
  "/api/v1/monitoring/ai-usage",
] as const;

const SCREEN_ROUTES = [
  "/",
  "/orders",
  "/orders/:id",
  "/documents",
  "/exceptions",
  "/governance",
] as const;

const ROLES_SEEN = [
  "APPROVER",
  "FINANCE",
  "SUPPORT",
  "WAREHOUSE",
  "MANAGEMENT",
];

const MOCK = { mock: true as const };

export function mockObservability(): ObservabilityReport {
  const random = new SeededRandom(SEED);
  const services: ServiceHealth[] = SERVICES.map((name, index) => ({
    name,
    // One degraded service, so the screen shows more than green.
    status: index === 1 ? "degraded" : "healthy",
    p95Ms: random.int(12, index === 1 ? 900 : 240),
    errorRate: index === 1 ? "2.40" : random.money(0, 0.5),
    requestsPerMinute: random.int(20, 600),
  }));
  const recentTraces: RecentTrace[] = Array.from({ length: 6 }, (_, index) => ({
    traceId: Array.from({ length: 32 }, () =>
      random.int(0, 15).toString(16),
    ).join(""),
    route: random.pick(TRACE_ROUTES),
    durationMs: random.int(8, 1_400),
    status: index === 4 ? 500 : 200,
  }));
  return { data: { services, recentTraces }, meta: MOCK };
}

export function mockClickstream(): ClickstreamSummary {
  const random = new SeededRandom(SEED + 1);
  return {
    data: {
      consentRate: random.money(40, 90),
      topRoutes: SCREEN_ROUTES.map((route) => ({
        route,
        views: random.int(40, 900),
      })).sort((a, b) => b.views - a.views),
      byRole: ROLES_SEEN.map((role) => ({
        role,
        events: random.int(60, 1_200),
      })),
    },
    meta: MOCK,
  };
}
