import { z } from "zod";
import { roleSchema } from "../roles.js";
import { classificationSchema, maskReasonSchema } from "./classification.js";

/**
 * A field as the server sends it after masking. When `masked` is true the
 * value is null: the real value never leaves the server, so it cannot be read
 * from the page or the network tab. The web app's MaskedValue shows the
 * reason.
 */
export const maskedFieldSchema = z.object({
  field: z.string().min(1),
  classification: classificationSchema,
  masked: z.boolean(),
  value: z.string().nullable(),
  reason: maskReasonSchema.nullable(),
});
export type MaskedField = z.infer<typeof maskedFieldSchema>;

/** A masking rule, as the screen lists it: the roles that see the field in full. */
export const maskingRuleSchema = z.object({
  field: z.string().min(1),
  label: z.string().min(1),
  classification: classificationSchema,
  reason: maskReasonSchema,
  visibleTo: z.array(roleSchema),
  /** True for the neutral example the base ships. Area 4 writes the real rules. */
  sample: z.boolean(),
});
export type MaskingRule = z.infer<typeof maskingRuleSchema>;
