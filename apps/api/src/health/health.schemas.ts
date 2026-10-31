import { dataEnvelope } from "@orderpilot/shared";
import { z } from "zod";

const checkResultSchema = z.object({
  name: z.string(),
  status: z.enum(["up", "down"]),
  durationMs: z.number().int().min(0),
});

export const liveResponseSchema = dataEnvelope(
  z.object({ status: z.literal("ok") }),
);

export const readinessResponseSchema = dataEnvelope(
  z.object({
    status: z.enum(["ok", "unavailable"]),
    checks: z.array(checkResultSchema),
  }),
);

export const healthResponseSchema = dataEnvelope(
  z.object({
    status: z.enum(["ok", "unavailable"]),
    checks: z.array(
      z.object({ name: z.string(), status: z.enum(["up", "down"]) }),
    ),
  }),
);
