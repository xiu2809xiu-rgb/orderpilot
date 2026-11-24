import {
  CLASSIFICATIONS,
  AI_PROVIDERS,
  DEFAULT_ROLE_PERMISSIONS,
  ROLES,
} from "@orderpilot/shared";
import { describe, expect, it } from "vitest";
import { DomainError } from "../../../common/domain-error.js";
import { decideAiDestination } from "./ai-destination-policy.js";
import { SAMPLE_RULES, mask, sampleNoteRule } from "./masking.js";
import {
  MatrixRuleRefusedError,
  assertCanGrant,
  assertCanRevoke,
  pairsToSeed,
  planCopy,
} from "./matrix-rules.js";

/** The refusal a rule threw, so a test can read which rule it names. */
function refusalOf(attempt: () => unknown): unknown {
  try {
    attempt();
  } catch (error) {
    return error instanceof MatrixRuleRefusedError ? error.refusal : error;
  }
  return null;
}

describe("matrix rules", () => {
  it("names the rule that refused, for the audit row (#378)", () => {
    expect(
      refusalOf(() => {
        assertCanGrant("SYSTEM_ADMIN", "payments.post");
      }),
    ).toEqual({
      rule: "locked-cell",
      permission: "payments.post",
      lock: "never",
    });
    expect(
      refusalOf(() => {
        assertCanRevoke("SYSTEM_ADMIN", "roles.manage");
      }),
    ).toEqual({
      rule: "locked-cell",
      permission: "roles.manage",
      lock: "always",
    });
    expect(refusalOf(() => planCopy("FINANCE", "FINANCE", [], []))).toEqual({
      rule: "same-role",
    });
    expect(
      refusalOf(() =>
        planCopy(
          "FINANCE",
          "SYSTEM_ADMIN",
          ["payments.post"],
          ["roles.manage"],
        ),
      ),
    ).toMatchObject({ rule: "locked-cell", lock: "never" });
  });

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

describe("the sample note's rule, read from the matrix (F-8)", () => {
  it("shows the note by default to the five roles the sample rule named", () => {
    const holders = ROLES.filter((role) =>
      (DEFAULT_ROLE_PERMISSIONS[role] as readonly string[]).includes(
        "masking.customerNote",
      ),
    );
    expect(holders).toEqual([
      "PRODUCT_MANAGER",
      "APPROVER",
      "SUPPORT",
      "MANAGEMENT",
      "AUDITOR",
    ]);
  });

  it("builds the rule from the roles the matrix gives it", () => {
    const rule = sampleNoteRule(["WAREHOUSE"]);
    expect(rule).toMatchObject({
      field: "sample.customerNote",
      classification: "internal",
      reason: "role",
      visibleTo: ["WAREHOUSE"],
    });
    expect(mask([rule], "WAREHOUSE", rule.field, "a note")).toMatchObject({
      masked: false,
      value: "a note",
    });
    expect(mask([rule], "SUPPORT", rule.field, "a note")).toMatchObject({
      masked: true,
      value: null,
      reason: "role",
    });
  });

  it("lists the roles in the matrix's order, however they arrive", () => {
    expect(
      sampleNoteRule(["AUDITOR", "SUPPORT", "APPROVER"]).visibleTo,
    ).toEqual(["APPROVER", "SUPPORT", "AUDITOR"]);
  });

  it("hides the note from everyone when the matrix shows it to nobody", () => {
    const rule = sampleNoteRule([]);
    for (const role of ROLES) {
      expect(mask([rule], role, rule.field, "a note").masked, role).toBe(true);
    }
  });
});

describe("which default pairs the seed adds (F-8)", () => {
  const defaults = {
    SUPPORT: ["orders.read", "orders.create"],
    WAREHOUSE: ["orders.read"],
  } as const;

  it("adds every default pair nobody revoked on purpose", () => {
    expect(pairsToSeed(defaults, [])).toEqual([
      { role: "SUPPORT", permission: "orders.read" },
      { role: "SUPPORT", permission: "orders.create" },
      { role: "WAREHOUSE", permission: "orders.read" },
    ]);
  });

  it("leaves out a pair revoked on purpose, and only that pair", () => {
    expect(
      pairsToSeed(defaults, [{ role: "SUPPORT", permission: "orders.read" }]),
    ).toEqual([
      { role: "SUPPORT", permission: "orders.create" },
      { role: "WAREHOUSE", permission: "orders.read" },
    ]);
  });

  it("is not changed by a revoked pair that is not a default", () => {
    expect(
      pairsToSeed(defaults, [{ role: "WAREHOUSE", permission: "users.read" }]),
    ).toHaveLength(3);
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
