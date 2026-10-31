import { CLASSIFICATIONS, AI_PROVIDERS, ROLES } from "@orderpilot/shared";
import { describe, expect, it } from "vitest";
import { DomainError } from "../../../common/domain-error.js";
import { decideAiDestination } from "./ai-destination-policy.js";
import { SAMPLE_RULES, mask } from "./masking.js";
import { assertCanGrant, assertCanRevoke, planCopy } from "./matrix-rules.js";

describe("matrix rules", () => {
  it("refuses to grant the system admin a right to approve, post or pay", () => {
    for (const permission of [
      "approvals.decide",
      "payments.confirm",
      "payments.post",
    ] as const) {
      expect(() => {
        assertCanGrant("SYSTEM_ADMIN", permission);
      }).toThrow(DomainError);
      expect(() => {
        assertCanGrant("FINANCE", permission);
      }).not.toThrow();
    }
  });

  it("refuses to revoke the right to edit the matrix from the system admin", () => {
    expect(() => {
      assertCanRevoke("SYSTEM_ADMIN", "roles.manage");
    }).toThrow(DomainError);
    expect(() => {
      assertCanRevoke("SUPPORT", "roles.manage");
    }).not.toThrow();
  });

  it("plans a copy as what to grant and what to revoke", () => {
    const plan = planCopy(
      "SUPPORT",
      "WAREHOUSE",
      ["orders.read", "documents.upload"],
      ["orders.read", "documents.read"],
    );
    expect(plan).toEqual({
      grant: ["documents.upload"],
      revoke: ["documents.read"],
    });
  });

  it("refuses a copy onto the same role, or one that breaks a locked cell", () => {
    expect(() => planCopy("FINANCE", "FINANCE", [], [])).toThrow(DomainError);
    expect(() =>
      planCopy("FINANCE", "SYSTEM_ADMIN", ["payments.post"], ["roles.manage"]),
    ).toThrow(DomainError);
  });
});

describe("masking", () => {
  const field = "sample.customerNote";

  it("returns the value only to a role the rule lists", () => {
    const shown = mask(SAMPLE_RULES, "SUPPORT", field, "a note");
    expect(shown).toMatchObject({ masked: false, value: "a note" });
  });

  it("returns null and the reason to every other role", () => {
    const hiddenFrom = ROLES.filter(
      (role) => !SAMPLE_RULES[0]?.visibleTo.includes(role),
    );
    expect(hiddenFrom.length).toBeGreaterThan(0);
    for (const role of hiddenFrom) {
      const hidden = mask(SAMPLE_RULES, role, field, "a note");
      expect(hidden).toMatchObject({
        masked: true,
        value: null,
        reason: "role",
      });
      expect(JSON.stringify(hidden)).not.toContain("a note");
    }
  });

  it("shows a field that has no rule", () => {
    expect(mask(SAMPLE_RULES, "WAREHOUSE", "other", "x").masked).toBe(false);
  });
});

describe("data sent to AI providers", () => {
  it("allows synthetic data of any classification to every provider", () => {
    for (const provider of AI_PROVIDERS) {
      for (const classification of CLASSIFICATIONS) {
        expect(
          decideAiDestination({ provider, classification, origin: "synthetic" })
            .allowed,
        ).toBe(true);
      }
    }
  });

  it("refuses real data to every provider by default", () => {
    for (const provider of AI_PROVIDERS) {
      const decision = decideAiDestination({
        provider,
        classification: "public",
        origin: "real",
      });
      expect(decision).toMatchObject({
        allowed: false,
        rule: "synthetic-data-only",
      });
    }
  });

  it("refuses a provider that has no rule, and a classification a rule leaves out", () => {
    expect(
      decideAiDestination(
        { provider: "mock", classification: "internal", origin: "synthetic" },
        [],
      ).rule,
    ).toBe("no-rule-for-provider");
    expect(
      decideAiDestination(
        {
          provider: "mock",
          classification: "restricted",
          origin: "synthetic",
        },
        [
          {
            provider: "mock",
            origins: ["synthetic"],
            classifications: ["public"],
          },
        ],
      ).rule,
    ).toBe("classification-not-allowed");
  });
});
