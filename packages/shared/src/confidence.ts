/**
 * How sure a reader is of a field it took from a document, as a ratio from 0
 * to 1. These two cut-offs are the only ones: the web app's confidence badge,
 * the demo documents' ground truth and the review screen all read them here, so
 * "uncertain" means the same thing everywhere.
 */
export const CONFIDENCE_HIGH = 0.9;
export const CONFIDENCE_MEDIUM = 0.7;

export type ConfidenceBand = "high" | "medium" | "low";

export function confidenceBand(confidence: number): ConfidenceBand {
  if (confidence >= CONFIDENCE_HIGH) return "high";
  if (confidence >= CONFIDENCE_MEDIUM) return "medium";
  return "low";
}

/** A field below the high band is one a person must confirm or correct. */
export function isUncertain(confidence: number): boolean {
  return confidence < CONFIDENCE_HIGH;
}
