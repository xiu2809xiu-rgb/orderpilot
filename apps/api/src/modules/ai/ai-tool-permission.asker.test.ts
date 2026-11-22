import { describe, expect, it, vi } from "vitest";
import type {
  AccessDecision,
  AccessRequest,
} from "../../auth/permission-policy.js";
import { AiToolPermissionAsker } from "./ai-tool-permission.asker.js";

const actor = {
  userId: "0190a1b2-0000-7000-8000-000000000001",
  role: "SUPPORT",
} as const;

function asker(decide: (request: AccessRequest) => AccessDecision) {
  const policy = vi.fn((request: AccessRequest) =>
    Promise.resolve(decide(request)),
  );
  return {
    policy,
    asker: new AiToolPermissionAsker({ decide: policy }),
  };
}

describe("the tool permission asker", () => {
  it("asks the policy about the person's id and role and the tool's permission", async () => {
    const h = asker(() => ({ allowed: true }));
    await expect(
      h.asker.ask({
        actor,
        permission: "orders.read",
        toolName: "stock_lookup",
        traceId: "t",
      }),
    ).resolves.toEqual({ allowed: true });
    const asked = h.policy.mock.calls[0]?.[0];
    expect(asked).toMatchObject({
      permission: "orders.read",
      user: { id: actor.userId, role: "SUPPORT" },
    });
  });

  it("passes the policy's refusal and its reason on, for the audit row", async () => {
    const h = asker(() => ({
      allowed: false,
      reason: "role-lacks-permission",
    }));
    await expect(
      h.asker.ask({
        actor,
        permission: "payments.confirm",
        toolName: "x",
        traceId: "t",
      }),
    ).resolves.toEqual({ allowed: false, reason: "role-lacks-permission" });
  });

  it("gives a refusal with no reason a reason of its own", async () => {
    const h = asker(() => ({ allowed: false }));
    await expect(
      h.asker.ask({
        actor,
        permission: "orders.read",
        toolName: "x",
        traceId: "t",
      }),
    ).resolves.toEqual({ allowed: false, reason: "not-allowed" });
  });
});
