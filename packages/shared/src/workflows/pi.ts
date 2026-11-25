import { z } from "zod";
import { recordNumberSchema } from "../record-number.js";
import { mockRecordedSchema, orderNoSchema } from "./common.js";

/** One reversal of a PI that went out: which issue, why, who and when. */
export const piReversalSchema = z.object({
  issue: z.number().int().min(1),
  reason: z.string().min(1),
  at: z.iso.datetime(),
  by: z.string().min(1),
});

/**
 * A PI that has been sent, on an order the state machine runs (#251, point 6).
 * An issued PI is fixed only by reverse and reissue, so its issue number goes
 * up and every reversal keeps its reason.
 */
export const orderPiSchema = z.object({
  recordNo: recordNumberSchema,
  /** 1 when first sent; each reverse and reissue adds one. */
  issue: z.number().int().min(1),
  sentAt: z.iso.datetime(),
  sentBy: z.string().min(1),
  reversals: z.array(piReversalSchema),
  /** Whether it can be reversed and reissued now: no payment yet, nothing packed. */
  reissuable: z.boolean(),
});
export type OrderPi = z.infer<typeof orderPiSchema>;

export const piReissueInputSchema = z.object({
  reason: z.string().trim().min(1, "Say why").max(500),
});
export type PiReissueInput = z.infer<typeof piReissueInputSchema>;

export const piReissueResultSchema = mockRecordedSchema.extend({
  orderNo: orderNoSchema,
  recordNo: recordNumberSchema,
  issue: z.number().int().min(2),
});
export type PiReissueResult = z.infer<typeof piReissueResultSchema>;
