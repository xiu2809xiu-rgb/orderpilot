import { dataEnvelope, pageEnvelope } from "@orderpilot/shared";
import { z } from "zod";

export const checkListResponseSchema = pageEnvelope(
  z.object({ name: z.string() }),
);

/** Each check run now: up or down, and how long it took to answer. */
export const checkStatusResponseSchema = dataEnvelope(
  z.array(
    z.object({
      name: z.string(),
      status: z.enum(["up", "down"]),
      durationMs: z.number().int().nonnegative(),
    }),
  ),
);
