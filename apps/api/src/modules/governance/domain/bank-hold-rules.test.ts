import { describe, expect, it } from "vitest";
import type { PolicyContext } from "./authorisation-policy.js";
import {
  BankDetailHoldRule,
  HoldVerificationRule,
  NEEDS_DIFFERENT_FINANCE_USER,
  blockedReasonOf,
  type HoldClearanceFacts,
} from "./bank-hold-rules.js";

const ME = "00000000-0000-4000-8000-000000000001";
const HOLD = "00000000-0000-7000-8000-00000000aaaa";
const OTHER_HOLD = "00000000-0000-7000-8000-00000000bbbb";

const NOW = new Date("2026-11-10T09:00:00.000Z");
const OPENED = new Date("2026-11-09T09:00:00.000Z");

const context = (overrides: Partial<PolicyContext> = {}): PolicyContext => ({
  actor: { userId: ME, role: "FINANCE" },
  action: "vendor-payment.release",
  permission: "payments.post",
  roleHoldsPermission: true,
  ...overrides,
});

describe("the bank-detail hold rule", () => {
  const rule = new BankDetailHoldRule();
  const held = {
    vendorHold: { vendorNo: "V-0007", openHoldIds: [HOLD] },
  };

  it("refuses releasing or approving a payment to a held vendor, naming the hold", () => {
    for (const action of ["vendor-payment.release", "vendor-payment.approve"]) {
      const reason = rule.refusal(context({ action, ...held }));
      expect(reason, action).toContain("V-0007");
      expect(reason, action).toContain(HOLD);
    }
  });

  it("names every open hold", () => {
    const reason = rule.refusal(
      context({
        vendorHold: { vendorNo: "V-0007", openHoldIds: [HOLD, OTHER_HOLD] },
      }),
    );
    expect(reason).toContain(HOLD);
    expect(reason).toContain(OTHER_HOLD);
  });

  it("has no objection to a vendor with no open hold", () => {
    expect(
      rule.refusal(
        context({ vendorHold: { vendorNo: "V-0007", openHoldIds: [] } }),
      ),
    ).toBeNull();
  });

  it("refuses a vendor payment that does not name its vendor", () => {
    expect(rule.refusal(context())).toContain("Business Central number");
    expect(
      rule.refusal(
        context({ vendorHold: { vendorNo: undefined, openHoldIds: [] } }),
      ),
    ).toContain("Business Central number");
  });

  it("looks only at payments to vendors", () => {
    for (const action of [
      "customer-payment.confirm",
      "payment-hold.clear",
      "spr.approve",
    ]) {
      expect(rule.refusal(context({ action, ...held })), action).toBeNull();
    }
  });
});

describe("the hold-verification rule", () => {
  const rule = new HoldVerificationRule();
  const openHold = {
    status: "open" as const,
    openedAt: OPENED,
    latestOutcome: null,
  };
  const attempt = {
    outcome: "confirmed" as const,
    contactedAt: new Date("2026-11-10T08:00:00.000Z"),
    contactFromStoredRecord: true,
  };
  const facts = (
    overrides: Partial<HoldClearanceFacts> = {},
  ): HoldClearanceFacts => ({ hold: openHold, now: NOW, ...overrides });
  const verify = (overrides: Partial<HoldClearanceFacts> = {}) =>
    rule.refusal(
      context({
        action: "payment-hold.verify",
        holdClearance: facts({ attempt, ...overrides }),
      }),
    );
  const clear = (overrides: Partial<HoldClearanceFacts> = {}) =>
    rule.refusal(
      context({
        action: "payment-hold.clear",
        holdClearance: facts({
          hold: { ...openHold, latestOutcome: "confirmed" },
          resolution: "accept-new-details",
          ...overrides,
        }),
      }),
    );

  it("looks only at the hold's own two steps", () => {
    expect(rule.refusal(context())).toBeNull();
  });

  describe("recording a verification", () => {
    it("allows a contact from the stored record", () => {
      expect(verify()).toBeNull();
    });

    it("refuses a confirmation whose contact came from the new document", () => {
      expect(
        verify({ attempt: { ...attempt, contactFromStoredRecord: false } }),
      ).toContain("stored record");
    });

    it("allows a rejection whatever the contact, since it only keeps the hold", () => {
      expect(
        verify({
          attempt: {
            ...attempt,
            outcome: "rejected",
            contactFromStoredRecord: false,
          },
        }),
      ).toBeNull();
    });

    it("refuses a contact in the future or before the hold opened", () => {
      for (const contactedAt of [
        new Date(NOW.getTime() + 1),
        new Date(OPENED.getTime() - 1),
      ]) {
        expect(verify({ attempt: { ...attempt, contactedAt } })).toContain(
          "hold opening and now",
        );
      }
    });

    it("allows a contact exactly when the hold opened, or exactly now", () => {
      for (const contactedAt of [OPENED, NOW]) {
        expect(verify({ attempt: { ...attempt, contactedAt } })).toBeNull();
      }
    });

    it("refuses a closed hold, a missing hold or a missing attempt", () => {
      expect(verify({ hold: { ...openHold, status: "cleared" } })).toContain(
        "closed",
      );
      expect(verify({ hold: null })).toContain("no such");
      expect(
        rule.refusal(
          context({ action: "payment-hold.verify", holdClearance: facts() }),
        ),
      ).toContain("outcome");
      expect(
        rule.refusal(context({ action: "payment-hold.verify" })),
      ).toContain("no such");
    });
  });

  describe("clearing a hold", () => {
    it("accepts the new details only after a confirmed verification", () => {
      expect(clear()).toBeNull();
      expect(
        clear({ hold: { ...openHold, latestOutcome: "rejected" } }),
      ).toContain("did not confirm");
    });

    it("keeps the stored details only after a rejected verification", () => {
      const keep = { resolution: "keep-stored-details" as const };
      expect(
        clear({ ...keep, hold: { ...openHold, latestOutcome: "rejected" } }),
      ).toBeNull();
      expect(clear(keep)).toContain("did not reject");
    });

    it("refuses any clearance before a verification is recorded", () => {
      expect(clear({ hold: openHold })).toContain("recorded verification");
    });

    it("refuses a closed hold, a missing hold or a missing resolution", () => {
      expect(
        clear({
          hold: { ...openHold, status: "cleared", latestOutcome: "confirmed" },
        }),
      ).toContain("closed");
      expect(clear({ hold: null })).toContain("no such");
      expect(
        rule.refusal(
          context({
            action: "payment-hold.clear",
            holdClearance: facts({
              hold: { ...openHold, latestOutcome: "confirmed" },
            }),
          }),
        ),
      ).toContain("resolution");
    });
  });
});

describe("why a hold cannot move", () => {
  const FINANCE = "00000000-0000-4000-8000-00000000f001";
  const FINANCE_2 = "00000000-0000-4000-8000-00000000f002";
  const hold = {
    status: "open" as const,
    changedByUserId: FINANCE,
    latestOutcome: null,
  };

  it("says so when the person who changed the details is the only one who could verify", () => {
    expect(blockedReasonOf(hold, new Set([FINANCE]))).toBe(
      "needs a different Finance user",
    );
    expect(NEEDS_DIFFERENT_FINANCE_USER).toBe("needs a different Finance user");
  });

  it("says so when nobody at all could verify", () => {
    expect(blockedReasonOf(hold, new Set())).toBe(NEEDS_DIFFERENT_FINANCE_USER);
    expect(blockedReasonOf({ ...hold, changedByUserId: null }, new Set())).toBe(
      NEEDS_DIFFERENT_FINANCE_USER,
    );
  });

  it("says nothing when someone else can verify", () => {
    expect(blockedReasonOf(hold, new Set([FINANCE, FINANCE_2]))).toBeNull();
    expect(
      blockedReasonOf({ ...hold, changedByUserId: null }, new Set([FINANCE])),
    ).toBeNull();
  });

  it("says nothing once a verification is recorded, or the hold is closed", () => {
    expect(
      blockedReasonOf({ ...hold, latestOutcome: "confirmed" }, new Set()),
    ).toBeNull();
    expect(
      blockedReasonOf({ ...hold, latestOutcome: "rejected" }, new Set()),
    ).toBeNull();
    expect(
      blockedReasonOf({ ...hold, status: "cleared" }, new Set()),
    ).toBeNull();
  });
});
