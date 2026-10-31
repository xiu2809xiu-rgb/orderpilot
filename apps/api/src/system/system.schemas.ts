import { pageEnvelope } from "@orderpilot/shared";
import { z } from "zod";

export const checkListResponseSchema = pageEnvelope(
  z.object({ name: z.string() }),
);
