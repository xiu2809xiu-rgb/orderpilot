import { describe, expect, it } from "vitest";
import type { PolicyContext } from "./authorisation-policy.js";
import {
  SEGREGATED_DUTIES,
  SegregationOfDutiesRule,
  type EarlierDuties,
} from "./segregation-of-duties.js";

const ME = "00000000-0000-4000-8000-000000000001";
const SOMEONE_ELSE = "00000000-0000-4000-8000-000000000002";

const context = (
  action: string,
  earlierDuties: EarlierDuties | undefined,
  requesterUserId?: string,
): PolicyContext => ({
  actor: { userId: ME, role: "FINANCE" },
  action,
  permission: "payments.post",
  roleHoldsPermission: true,
  requesterUserId,
  earlierDuties,
});

describe("the duties kept apart", () => {
  it("holds the pairs F-4 names, the bank-detail change against payments, and F-5's two people", () => {
    expect(SEGREGATED_DUTIES).toEqual([
      { earlier: "spr.raise", later: ["spr.approve"] },
      { earlier: "vendor-payment.approve", later: ["payment-hold.clear"] },
      {
        earlier: "vendor-bank.change",
        later: [
          "payment-hold.verify",
          "payment-hold.clear",
          "vendor-payment.approve",
          "vendor-payment.release",
        ],
      },
      { earlier: "payment-hold.verify", later: ["payment-hold.clear"] },
    ]);
  });
});

describe("the segregation-of-duties rule", () => {
  const rule = new SegregationOfDutiesRule();

  it("refuses the person who approved a vendor payment clearing its hold", () => {
    expect(
      rule.refusal(
        context("payment-hold.clear", { "vendor-payment.approve": ME }),
      ),
    ).toBe(
      "vendor-payment.approve and payment-hold.clear are done by different people",
    );
    expect(
      rule.refusal(
        context("payment-hold.clear", {
          "vendor-payment.approve": SOMEONE_ELSE,
        }),
      ),
    ).toBeNull();
  });

  it("refuses the person who verified a hold clearing it", () => {
    expect(
      rule.refusal(
        context("payment-hold.clear", { "payment-hold.verify": ME }),
      ),
    ).toBe(
      "payment-hold.verify and payment-hold.clear are done by different people",
    );
    expect(
      rule.refusal(
        context("payment-hold.clear", { "payment-hold.verify": SOMEONE_ELSE }),
      ),
    ).toBeNull();
  });

  it("refuses whoever changed a vendor's bank details verifying, approving, releasing or clearing a payment to them", () => {
    for (const action of [
      "payment-hold.verify",
      "vendor-payment.approve",
      "vendor-payment.release",
      "payment-hold.clear",
    ]) {
      expect(
        rule.refusal(context(action, { "vendor-bank.change": ME })),
        action,
      ).not.toBeNull();
      expect(
        rule.refusal(context(action, { "vendor-bank.change": SOMEONE_ELSE })),
        action,
      ).toBeNull();
    }
  });

  it("reads who raised an SPR from the requester, not from the earlier duties", () => {
    expect(rule.refusal(context("spr.approve", undefined, ME))).not.toBeNull();
    expect(
      rule.refusal(context("spr.approve", undefined, SOMEONE_ELSE)),
    ).toBeNull();
  });

  it("keeps confirming a customer's payment out of every pair", () => {
    expect(
      rule.refusal(
        context("customer-payment.confirm", {
          "vendor-payment.approve": ME,
          "vendor-bank.change": ME,
        }),
      ),
    ).toBeNull();
  });

  it("has no objection when nobody did an earlier duty", () => {
    expect(
      rule.refusal(context("vendor-payment.release", undefined)),
    ).toBeNull();
    expect(rule.refusal(context("vendor-payment.release", {}))).toBeNull();
  });
});
