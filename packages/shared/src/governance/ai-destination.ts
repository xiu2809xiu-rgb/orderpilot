import { z } from "zod";
import { classificationSchema } from "./classification.js";

/** The providers the AI gateway (P-17) can send to. */
export const AI_PROVIDERS = ["mock", "openai-compatible", "bedrock"] as const;
export const aiProviderSchema = z.enum(AI_PROVIDERS);
export type AiProvider = z.infer<typeof aiProviderSchema>;

export const DATA_ORIGINS = ["synthetic", "real"] as const;
export const dataOriginSchema = z.enum(DATA_ORIGINS);
export type DataOrigin = z.infer<typeof dataOriginSchema>;

/** The question the gateway asks before it sends anything. */
export const aiDestinationRequestSchema = z.object({
  provider: aiProviderSchema,
  classification: classificationSchema,
  origin: dataOriginSchema,
});
export type AiDestinationRequest = z.infer<typeof aiDestinationRequestSchema>;

export const aiDestinationDecisionSchema = z.object({
  allowed: z.boolean(),
  rule: z.string().min(1),
  reason: z.string().min(1),
});
export type AiDestinationDecision = z.infer<typeof aiDestinationDecisionSchema>;

/** One provider's rule: which origins and classifications may go to it. */
export const aiDestinationRuleSchema = z.object({
  provider: aiProviderSchema,
  origins: z.array(dataOriginSchema),
  classifications: z.array(classificationSchema),
});
export type AiDestinationRule = z.infer<typeof aiDestinationRuleSchema>;
