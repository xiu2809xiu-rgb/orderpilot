import type { ReviewItem } from "@orderpilot/shared";

/** The data-rule ids the review line has a sentence for. Any other id gets the general sentence. */
const KNOWN_NOT_ALLOWED = [
  "synthetic-data-only",
  "classification-not-allowed",
  "no-rule-for-provider",
  "policy-unavailable",
] as const;
const KNOWN_NOT_RUN = ["timeout", "failed", "mock"] as const;

function known<T extends string>(
  list: readonly T[],
  why: string | null,
): T | "other" {
  return list.find((id) => id === why) ?? "other";
}

/**
 * The key of the sentence that says what the AI check did. The reason is a
 * rule id or a code for developers, so it is never drawn: only a sentence
 * written for it, or the general one.
 */
export function aiLineKey(ai: ReviewItem["ai"]): string {
  switch (ai.status) {
    case "CHECKED":
      return `pictures.ai.CHECKED.${ai.verdict === "LOOKS_FINE" ? "LOOKS_FINE" : "NEEDS_A_CLOSER_LOOK"}`;
    case "NOT_ALLOWED":
      return `pictures.ai.NOT_ALLOWED.${known(KNOWN_NOT_ALLOWED, ai.why)}`;
    case "NOT_RUN":
      return `pictures.ai.NOT_RUN.${known(KNOWN_NOT_RUN, ai.why)}`;
  }
}
