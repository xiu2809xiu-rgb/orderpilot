import { z } from "zod";
import { aiUsageSchema } from "../audit.js";
import { pageMetaSchema } from "../envelope.js";
import { decimalStringSchema } from "../money.js";

/** Totals over every record. Cost is a decimal string, never a float. */
export const aiUsageSummarySchema = z.object({
  calls: z.int().min(0),
  inputTokens: z.int().min(0),
  outputTokens: z.int().min(0),
  costUsd: decimalStringSchema,
  failedCalls: z.int().min(0),
});
export type AiUsageSummary = z.infer<typeof aiUsageSummarySchema>;

export const aiUsageByFeatureSchema = z.object({
  feature: z.string().min(1),
  calls: z.int().min(0),
  costUsd: decimalStringSchema,
});
export type AiUsageByFeature = z.infer<typeof aiUsageByFeatureSchema>;

/**
 * The AI usage and cost screen's one read: totals, cost per feature and the
 * latest records. Empty until the gateway (P-17) writes the first record.
 */
export const aiUsageReportSchema = z.object({
  data: z.object({
    summary: aiUsageSummarySchema,
    byFeature: z.array(aiUsageByFeatureSchema),
    records: z.array(aiUsageSchema),
  }),
  meta: pageMetaSchema,
});
export type AiUsageReport = z.infer<typeof aiUsageReportSchema>;
