import {
  aiDestinationDecisionSchema,
  aiDestinationRuleSchema,
  dataEnvelope,
  maskedFieldSchema,
  maskingRuleSchema,
  matrixSchema,
  roleAccessSchema,
} from "@orderpilot/shared";
import { z } from "zod";

export const matrixResponseSchema = dataEnvelope(matrixSchema);
export const roleAccessResponseSchema = dataEnvelope(roleAccessSchema);

/** One synthetic customer with the sample rule applied for the caller's role. */
export const maskingSampleRecordSchema = z.object({
  customerNo: z.string(),
  customerName: z.string(),
  note: maskedFieldSchema,
});
export type MaskingSampleRecord = z.infer<typeof maskingSampleRecordSchema>;

export const maskingSampleResponseSchema = z.object({
  data: z.object({
    rules: z.array(maskingRuleSchema),
    records: z.array(maskingSampleRecordSchema),
  }),
  // The records are synthetic. The page says so with the Mock badge.
  meta: z.object({ mock: z.literal(true) }),
});

export const aiRulesResponseSchema = dataEnvelope(
  z.array(aiDestinationRuleSchema),
);
export const aiDecisionResponseSchema = dataEnvelope(
  aiDestinationDecisionSchema,
);
