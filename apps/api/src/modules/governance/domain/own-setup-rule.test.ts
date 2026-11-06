import { describe, expect, it } from "vitest";
import type { PolicyContext } from "./authorisation-policy.js";
import { OwnSetupRule } from "./own-setup-rule.js";

const ADMIN = "00000000-0000-4000-8000-000000000001";
const APPROVER = "00000000-0000-4000-8000-000000000002";

const change = (setupOf: string, action = "approval-setup.change") =>
  ({
    actor: { userId: ADMIN, role: "SYSTEM_ADMIN" },
    action,
    permission: "roles.manage",
    roleHoldsPermission: true,
    resource: { type: "ApprovalUserSetup", id: setupOf },
  }) satisfies PolicyContext;

describe("the own-setup rule", () => {
  const rule = new OwnSetupRule();

  it("refuses anyone changing their own approval setup, even holding roles.manage", () => {
    expect(rule.refusal(change(ADMIN))).toBe(
      "nobody changes their own approval limits or substitute",
    );
  });

  it("lets someone with the right change another person's setup", () => {
    expect(rule.refusal(change(APPROVER))).toBeNull();
  });

  it("looks only at changes to an approval setup", () => {
    expect(rule.refusal(change(ADMIN, "spr.approve"))).toBeNull();
    expect(
      rule.refusal({
        ...change(ADMIN),
        resource: { type: "Spr", id: ADMIN },
      }),
    ).toBeNull();
  });
});
