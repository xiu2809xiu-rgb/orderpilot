import type {
  Classification,
  MaskedField,
  MaskingRule,
  Role,
} from "@orderpilot/shared";

/**
 * The masking mechanism. A rule names a field, its classification, the roles
 * that see it in full, and the reason shown to everyone else. `mask` returns
 * the value only to a role the rule lists. For anyone else the value is null,
 * so it never leaves the server and cannot be read from the page.
 *
 * Only the neutral sample rule below ships with the base. The real rules
 * (bank details, prices, who sees what and why) are area 4's.
 */

/** A field with no rule is shown. Add a rule to hide it. */
export function mask(
  rules: readonly MaskingRule[],
  role: Role,
  field: string,
  value: string,
  fallback: Classification = "internal",
): MaskedField {
  const rule = rules.find((candidate) => candidate.field === field);
  if (!rule || rule.visibleTo.includes(role)) {
    return {
      field,
      classification: rule?.classification ?? fallback,
      masked: false,
      value,
      reason: null,
    };
  }
  return {
    field,
    classification: rule.classification,
    masked: true,
    value: null,
    reason: rule.reason,
  };
}

/** The one example rule: an internal customer note that floor roles do not need. */
export const SAMPLE_RULES: readonly MaskingRule[] = [
  {
    field: "sample.customerNote",
    label: "Customer note (sample rule)",
    classification: "internal",
    reason: "role",
    visibleTo: [
      "PRODUCT_MANAGER",
      "APPROVER",
      "SUPPORT",
      "MANAGEMENT",
      "AUDITOR",
    ],
    sample: true,
  },
];
