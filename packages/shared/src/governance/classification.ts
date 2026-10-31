import { z } from "zod";

/**
 * How sensitive a piece of data is. The same four levels the web app's
 * ClassificationBadge draws and the data-to-AI policy keys off. Which field
 * gets which level is area 4's to decide (field by field); this is the scale.
 */
export const CLASSIFICATIONS = [
  "public",
  "internal",
  "confidential",
  "restricted",
] as const;
export const classificationSchema = z.enum(CLASSIFICATIONS);
export type Classification = z.infer<typeof classificationSchema>;

/**
 * Why a value is hidden. The web app's MaskedValue has a sentence for each, so
 * the server picks the reason and the screen only words it.
 */
export const MASK_REASONS = ["role", "bankDetails", "price", "policy"] as const;
export const maskReasonSchema = z.enum(MASK_REASONS);
export type MaskReason = z.infer<typeof maskReasonSchema>;
