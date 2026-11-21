import type { SparkErrorCode } from "@orderpilot/shared";
import {
  AiDestinationRefusedError,
  outcomeOfError,
  type AiCallOutcome,
} from "../../ai/domain/ai-errors.js";

/** How a failed gateway call is stored and audited. */
export interface SparkFailure {
  /** What the person is told: one of a short list, never a message and never a rule. */
  readonly code: SparkErrorCode;
  /** The gateway's own words for the outcome, for the audit row only. */
  readonly outcome: AiCallOutcome;
  readonly reasonCode: string;
}

/**
 * Reduces what the gateway threw to a stored failure. The gateway's own mapping
 * (`outcomeOfError`) says what happened and in a short code; this only picks
 * the coarser word a person may see. A destination refusal is just "refused",
 * because naming the rule would tell whoever is probing what a provider takes.
 */
export function failureOf(error: unknown): SparkFailure {
  const { outcome, reasonCode } = outcomeOfError(error);
  return { code: codeOf(error, outcome, reasonCode), outcome, reasonCode };
}

function codeOf(
  error: unknown,
  outcome: AiCallOutcome,
  reasonCode: string,
): SparkErrorCode {
  if (error instanceof AiDestinationRefusedError) return "refused";
  if (outcome === "timeout") return "timeout";
  if (reasonCode === "invalid-output") return "invalid-output";
  if (reasonCode === "tool-steps-exceeded") return "too-many-steps";
  if (
    reasonCode.startsWith("provider-") ||
    reasonCode === "mock-script-missing"
  ) {
    return "provider-error";
  }
  return "internal";
}
