import { z } from "zod";

// The two routes' contracts are shared (packages/shared/src/ai.ts), because the
// web client is generated from them. What stays here is the part only the API
// uses: the shape the probe asks a model to answer in.

export {
  aiProbeInputSchema,
  aiProbeResponseSchema,
  aiStatusResponseSchema,
  type AiProbeInput,
} from "@orderpilot/shared";

/**
 * What the structured probe asks for: one string field. A model that adds a
 * key is still answering, and the gateway drops keys the schema does not name.
 */
export const probeAnswerSchema = z.object({ status: z.string().min(1) });
export type ProbeAnswer = z.infer<typeof probeAnswerSchema>;
