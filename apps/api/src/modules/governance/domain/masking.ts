import {
  ROLES,
  type Classification,
  type MaskedField,
  type MaskingRule,
  type Role,
} from "@orderpilot/shared";

/**
 * The masking mechanism. A rule names a field, its classification, the roles
 * that see it in full, and the reason shown to everyone else. `mask` returns
 * the value only to a role the rule lists. For anyone else the value is null,
 * so it never leaves the server and cannot be read from the page.
 *
 * Only sample rules ship with the base. The real rules (bank details, prices,
 * who sees what and why) are area 4's: the master data pages use the samples
 * below until the owner confirms or replaces them.
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

/** Bank details stay with the role that pays vendors. */
const bankRule = (field: string, label: string): MaskingRule => ({
  field,
  label: `${label} (sample rule)`,
  classification: "restricted",
  reason: "bankDetails",
  visibleTo: ["FINANCE"],
  sample: true,
});

/**
 * Account figures go with the selling price: the roles that quote see them,
 * and Warehouse and Logistics, who never price anything, do not. A sample for
 * area 4 to confirm.
 */
const accountRule = (field: string, label: string): MaskingRule => ({
  field,
  label: `${label} (sample rule)`,
  classification: "confidential",
  reason: "role",
  visibleTo: [
    "PRODUCT_MANAGER",
    "APPROVER",
    "SUPPORT",
    "FINANCE",
    "MANAGEMENT",
    "AUDITOR",
  ],
  sample: true,
});

/**
 * The sample note's rule, for the roles the matrix says may see it: whoever
 * holds `masking.customerNote` (F-8). The roles keep the matrix's order, so the
 * screen lists them as the matrix does.
 */
export function sampleNoteRule(holders: readonly Role[]): MaskingRule {
  const set = new Set(holders);
  return {
    field: "sample.customerNote",
    label: "Customer note (sample rule)",
    classification: "internal",
    reason: "role",
    visibleTo: ROLES.filter((role) => set.has(role)),
    sample: true,
  };
}

/**
 * First an internal customer note floor roles do not need, then master data's
 * rules. The note's roles here are the default matrix's; the masking sample
 * reads the live matrix instead (PolicyService).
 */
export const SAMPLE_RULES: readonly MaskingRule[] = [
  sampleNoteRule([
    "PRODUCT_MANAGER",
    "APPROVER",
    "SUPPORT",
    "MANAGEMENT",
    "AUDITOR",
  ]),
  bankRule("vendor.bankName", "Vendor bank name"),
  bankRule("vendor.bankAccountNo", "Vendor bank account number"),
  bankRule("vendor.swiftCode", "Vendor SWIFT code"),
  bankRule("vendor.iban", "Vendor IBAN"),
  {
    field: "item.unitCost",
    label: "Item cost and amounts built from it (sample rule)",
    classification: "confidential",
    reason: "price",
    visibleTo: ["FINANCE", "MANAGEMENT", "PRODUCT_MANAGER"],
    sample: true,
  },
  {
    field: "item.unitPrice",
    label: "Selling price and amounts built from it (sample rule)",
    classification: "confidential",
    reason: "price",
    visibleTo: [
      "PRODUCT_MANAGER",
      "APPROVER",
      "SUPPORT",
      "FINANCE",
      "MANAGEMENT",
      "AUDITOR",
    ],
    sample: true,
  },
  accountRule("customer.creditLimitLcy", "Customer credit limit"),
  accountRule("customer.balanceLcy", "Customer balance"),
  accountRule("vendor.balanceLcy", "Vendor balance"),
];

const bankHoldRule = (field: string, label: string): MaskingRule => ({
  field,
  label,
  classification: "restricted",
  reason: "bankDetails",
  visibleTo: ["FINANCE", "APPROVER", "MANAGEMENT", "AUDITOR"],
  sample: false,
});

/**
 * A hold shows the last four at most, and only to those who must act on it or
 * audit it. Everyone else who can read a hold still sees which field differs.
 */
export const BANK_HOLD_MASKING_RULES: readonly MaskingRule[] = [
  bankHoldRule("bankHold.bankAccountNo", "Bank account number on a hold"),
  bankHoldRule("bankHold.swiftCode", "SWIFT code on a hold"),
  bankHoldRule("bankHold.iban", "IBAN on a hold"),
  bankHoldRule("bankHold.note", "What a person wrote about a hold"),
];
