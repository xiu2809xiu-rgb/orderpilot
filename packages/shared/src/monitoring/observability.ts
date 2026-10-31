import { z } from "zod";
import { decimalStringSchema } from "../money.js";
import { routePatternSchema } from "./clickstream.js";

/**
 * The observability and clickstream screens draw these. The API answers with
 * labelled mock data until Angelyn builds the real dashboards (Sprints 13 to
 * 15), so every response says `meta.mock: true`.
 */
export const SERVICE_STATUSES = ["healthy", "degraded", "down"] as const;

export const serviceHealthSchema = z.object({
  name: z.string().min(1),
  status: z.enum(SERVICE_STATUSES),
  p95Ms: z.int().min(0),
  errorRate: decimalStringSchema,
  requestsPerMinute: z.int().min(0),
});
export type ServiceHealth = z.infer<typeof serviceHealthSchema>;

export const recentTraceSchema = z.object({
  traceId: z.string().min(1),
  route: routePatternSchema,
  durationMs: z.int().min(0),
  status: z.int().min(100).max(599),
});
export type RecentTrace = z.infer<typeof recentTraceSchema>;

export const observabilityReportSchema = z.object({
  data: z.object({
    services: z.array(serviceHealthSchema),
    recentTraces: z.array(recentTraceSchema),
  }),
  meta: z.object({ mock: z.literal(true) }),
});
export type ObservabilityReport = z.infer<typeof observabilityReportSchema>;

export const clickstreamSummarySchema = z.object({
  data: z.object({
    consentRate: decimalStringSchema,
    topRoutes: z.array(
      z.object({ route: routePatternSchema, views: z.int().min(0) }),
    ),
    byRole: z.array(
      z.object({ role: z.string().min(1), events: z.int().min(0) }),
    ),
  }),
  meta: z.object({ mock: z.literal(true) }),
});
export type ClickstreamSummary = z.infer<typeof clickstreamSummarySchema>;
