import {
  AI_PROVIDERS,
  CLASSIFICATIONS,
  type AiDestinationDecision,
  type AiDestinationRequest,
  type AiDestinationRule,
} from "@orderpilot/shared";

/**
 * What data may go to which AI provider. The AI gateway (P-17) asks
 * `decide` before it sends anything, so the answer lives in one place.
 *
 * The default is synthetic data only: every provider may receive synthetic
 * data of any classification, and real data goes nowhere. Area 4 widens it
 * rule by rule (R-03 in GRS by design), each widening a reviewed decision.
 */
export const DEFAULT_AI_RULES: readonly AiDestinationRule[] = AI_PROVIDERS.map(
  (provider) => ({
    provider,
    origins: ["synthetic"],
    classifications: [...CLASSIFICATIONS],
  }),
);

export function decideAiDestination(
  request: AiDestinationRequest,
  rules: readonly AiDestinationRule[] = DEFAULT_AI_RULES,
): AiDestinationDecision {
  const rule = rules.find(
    (candidate) => candidate.provider === request.provider,
  );
  if (!rule) {
    return {
      allowed: false,
      rule: "no-rule-for-provider",
      reason: `No rule lets data go to ${request.provider}.`,
    };
  }
  if (!rule.origins.includes(request.origin)) {
    return {
      allowed: false,
      rule: "synthetic-data-only",
      reason: `Only synthetic data may go to ${request.provider}; this is ${request.origin} data.`,
    };
  }
  if (!rule.classifications.includes(request.classification)) {
    return {
      allowed: false,
      rule: "classification-not-allowed",
      reason: `${request.classification} data may not go to ${request.provider}.`,
    };
  }
  return {
    allowed: true,
    rule: "provider-rule",
    reason: `${request.origin} ${request.classification} data may go to ${request.provider}.`,
  };
}
