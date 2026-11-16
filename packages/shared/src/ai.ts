// The contract of the two AI routes (P-17): what is configured, and a probe that
// checks a provider end to end. The gateway's own calls are not a contract here:
// no route forwards free text to a model.

import { z } from "zod";
import { AI_USAGE_STATUSES } from "./audit.js";
import { dataEnvelope } from "./envelope.js";
import { aiProviderSchema } from "./governance/ai-destination.js";

/**
 * The values of the AI_PROVIDER setting. `gemini` and `groq` are presets of the
 * OpenAI-compatible provider: the policy sees them as that kind.
 */
export const AI_PROVIDER_SETTINGS = [
  "mock",
  "gemini",
  "groq",
  "openai-compatible",
  "bedrock",
] as const;
export const aiProviderSettingSchema = z.enum(AI_PROVIDER_SETTINGS);
export type AiProviderSetting = z.infer<typeof aiProviderSettingSchema>;

/**
 * What the gateway is set to use. Deliberately no key and no base URL: any
 * signed-in person may read it, and a secret must never travel in a response.
 */
export const aiStatusSchema = z.object({
  provider: aiProviderSettingSchema,
  kind: aiProviderSchema,
  model: z.string().min(1),
  /** True when the answers are scripted, so the web app shows "Mock AI". */
  mock: z.boolean(),
});
export type AiStatus = z.infer<typeof aiStatusSchema>;
export const aiStatusResponseSchema = dataEnvelope(aiStatusSchema);

export const AI_PROBE_MODES = ["text", "structured"] as const;
export const aiProbeModeSchema = z.enum(AI_PROBE_MODES);
export type AiProbeMode = z.infer<typeof aiProbeModeSchema>;

/** Strict: the probe sends one fixed prompt, so nothing else is accepted. */
export const aiProbeInputSchema = z.strictObject({ mode: aiProbeModeSchema });
export type AiProbeInput = z.infer<typeof aiProbeInputSchema>;

/**
 * The outcome of one probe. A failed provider call is a result here, not a
 * failed request, so `reasonCode` is a short code and never a message. The
 * token and attempt figures are null when the outcome is not "ok": the gateway
 * keeps a failed call's figures in its usage record and does not hand them to
 * its caller, and a zero would claim a count nobody made.
 */
export const aiProbeResultSchema = z.object({
  provider: aiProviderSettingSchema,
  kind: aiProviderSchema,
  model: z.string().min(1),
  mock: z.boolean(),
  outcome: z.enum(AI_USAGE_STATUSES),
  reasonCode: z.string().min(1).nullable(),
  latencyMs: z.int().min(0),
  inputTokens: z.int().min(0).nullable(),
  outputTokens: z.int().min(0).nullable(),
  /** Provider requests made. */
  attempts: z.int().min(0).nullable(),
});
export type AiProbeResult = z.infer<typeof aiProbeResultSchema>;
export const aiProbeResponseSchema = dataEnvelope(aiProbeResultSchema);
