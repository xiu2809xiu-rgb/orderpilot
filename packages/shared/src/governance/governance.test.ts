import { describe, expect, it } from "vitest";
import {
  ALWAYS_FOR_SYSTEM_ADMIN,
  DATA_SCOPES,
  DEFAULT_DATA_SCOPES,
  DEFAULT_ROLE_PERMISSIONS,
  LOCKED_CELLS,
  NEVER_FOR_SYSTEM_ADMIN,
  PAYMENT_TYPES,
  ROLES,
  aiDestinationRequestSchema,
  approvalUserSetupSchema,
  maskedFieldSchema,
  paymentConfirmationSchema,
  policyDecisionSchema,
} from "../index.js";

describe("the default matrix", () => {
  it("never lets the system admin approve, post or pay", () => {
    for (const permission of NEVER_FOR_SYSTEM_ADMIN) {
      expect(DEFAULT_ROLE_PERMISSIONS.SYSTEM_ADMIN).not.toContain(permission);
    }
  });

  it("keeps the permission that edits the matrix on the system admin", () => {
    for (const permission of ALWAYS_FOR_SYSTEM_ADMIN) {
      expect(DEFAULT_ROLE_PERMISSIONS.SYSTEM_ADMIN).toContain(permission);
    }
  });

  it("lists every locked cell once, each with a reason", () => {
    const keys = LOCKED_CELLS.map((cell) => `${cell.role}:${cell.permission}`);
    expect(new Set(keys).size).toBe(keys.length);
    expect(LOCKED_CELLS.every((cell) => cell.reason.length > 0)).toBe(true);
  });

  it("gives every role a data scope, and the product manager only its brands", () => {
    expect(Object.keys(DEFAULT_DATA_SCOPES).sort()).toEqual([...ROLES].sort());
    for (const scope of Object.values(DEFAULT_DATA_SCOPES)) {
      expect(DATA_SCOPES).toContain(scope);
    }
    expect(DEFAULT_DATA_SCOPES.PRODUCT_MANAGER).toBe("brands");
  });
});

describe("the governance contracts", () => {
  it("records a payment type, prepayment among them", () => {
    expect(PAYMENT_TYPES).toContain("prepayment");
    const parsed = paymentConfirmationSchema.safeParse({
      orderNo: "SO-1001",
      paymentType: "prepayment",
      amount: "1250.50",
      confirmedByUserId: "0190a000-0000-7000-8000-000000000001",
      confirmedAt: "2026-11-01T08:00:00.000Z",
    });
    expect(parsed.success).toBe(true);
  });

  it("follows the shape of Navision's Approval User Setup", () => {
    const parsed = approvalUserSetupSchema.safeParse({
      userId: "0190a000-0000-7000-8000-000000000001",
      approverId: "0190a000-0000-7000-8000-000000000002",
      salesAmountApprovalLimit: "5000",
      purchaseAmountApprovalLimit: "2000",
      unlimitedSalesApproval: false,
      unlimitedPurchaseApproval: false,
      substituteUserId: null,
    });
    expect(parsed.success).toBe(true);
  });

  it("describes a decision as an outcome, a rule and a reason", () => {
    expect(
      policyDecisionSchema.safeParse({
        outcome: "refused",
        rule: "no-self-approval",
        reason: "The requester cannot approve their own request.",
      }).success,
    ).toBe(true);
    expect(policyDecisionSchema.safeParse({ outcome: "refused" }).success).toBe(
      false,
    );
  });

  it("accepts only known providers, classifications and origins", () => {
    expect(
      aiDestinationRequestSchema.safeParse({
        provider: "mock",
        classification: "internal",
        origin: "synthetic",
      }).success,
    ).toBe(true);
    expect(
      aiDestinationRequestSchema.safeParse({
        provider: "elsewhere",
        classification: "internal",
        origin: "synthetic",
      }).success,
    ).toBe(false);
  });

  it("describes a masked field with no value", () => {
    expect(
      maskedFieldSchema.safeParse({
        field: "sample.internalNote",
        classification: "internal",
        masked: true,
        value: null,
        reason: "role",
      }).success,
    ).toBe(true);
  });
});
