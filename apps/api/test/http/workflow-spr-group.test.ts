import { ROLES, type Role } from "@orderpilot/shared";
import { syntheticDataset } from "@orderpilot/synthetic-data";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { demoEmail } from "../../src/auth/demo-accounts.js";
import { PasswordHasher } from "../../src/auth/domain/password-hasher.js";
import { Database } from "../../src/database/database.js";
import { ApprovalSetupRepository } from "../../src/modules/governance/approval-setup.repository.js";
import { OrderWorkflowService } from "../../src/modules/workflows/order-workflow.service.js";
import {
  handedTaskListResponseSchema,
  sprResponseSchema,
} from "../../src/modules/workflows/workflows.schemas.js";
import { UserRepository } from "../../src/users/user.repository.js";
import {
  API,
  auditEvents,
  call,
  demoSignIn,
  passwordSignIn,
  type Browser,
} from "../support/auth.js";
import { TEST_DEMO_PASSWORD } from "../support/infrastructure.js";
import { resetTestData } from "../support/reset.js";
import { createTestApp, type TestApp } from "../support/test-app.js";

const W = `${API}/workflows`;
const PENDING = syntheticDataset().sprs.filter((s) => s.status === "submitted");
const OTHER_APPROVER = "approver.group@example.test";
const OTHER_NAME = "Group Approver";

type Who = Role | "OTHER_APPROVER";

/**
 * The approver group (#251, ADR 0056): any one management approver except the
 * requester decides, the first decision closes the SPR, and nothing is passed
 * on. Run with each setting of approval limits, on area 4's real policy.
 */
async function groupHarness(limits: "on" | "off") {
  await resetTestData();
  const t = await createTestApp({
    APPROVER_GROUP: "on",
    APPROVAL_LIMITS: limits,
  });
  const users = t.app.get(UserRepository);
  const other =
    (await users.findByEmail(OTHER_APPROVER)) ??
    (await users.create({
      email: OTHER_APPROVER,
      displayName: OTHER_NAME,
      role: "APPROVER",
      passwordHash: await t.app.get(PasswordHasher).hash(TEST_DEMO_PASSWORD),
    }));
  const sessions = new Map<Who, Browser>();
  for (const role of ROLES) sessions.set(role, await demoSignIn(t, role));
  sessions.set("OTHER_APPROVER", await passwordSignIn(t, OTHER_APPROVER));
  return { t, otherId: other.id, sessions };
}

describe("the SPR approver group (#251, ADR 0056)", () => {
  let t: TestApp;
  let otherId = "";
  let sessions = new Map<Who, Browser>();
  let next = 0;

  const as = (who: Who): Browser => {
    const browser = sessions.get(who);
    if (!browser) throw new Error(`No session for ${who}`);
    return browser;
  };
  const idOf = async (role: Role): Promise<string> => {
    const user = await t.app.get(UserRepository).findByEmail(demoEmail(role));
    if (!user) throw new Error(`No demo user for ${role}`);
    return user.id;
  };
  const decide = (who: Who, recordNo: string, action: "approve" | "reject") =>
    call(t, as(who), "post", `${W}/sprs/${recordNo}/${action}`, {
      csrf: true,
      body: { comment: "Checked against the quote." },
    });
  const statusOf = async (orderNo: string) =>
    (await t.app.get(OrderWorkflowService).statusOf(orderNo))?.status;
  const sprPage = async (recordNo: string) => {
    const res = await call(t, as("APPROVER"), "get", `${W}/sprs/${recordNo}`);
    expect(res.status).toBe(200);
    return sprResponseSchema.parse(res.body).data;
  };
  /** A seeded SPR waiting for a decision, raised by `requester`, at `amount`. */
  const pendingSpr = async (amount: string, requesterUserId?: string) => {
    const spr = PENDING[next];
    next += 1;
    if (!spr) throw new Error("The dataset has too few pending SPRs");
    const database = t.app.get(Database);
    const row = await database.client.workflowRecord.findUniqueOrThrow({
      where: { recordNo: spr.recordNo },
    });
    await database.client.workflowRecord.update({
      where: { recordNo: spr.recordNo },
      data: {
        data: {
          ...(row.data as object),
          amount,
          requesterUserId: requesterUserId ?? (await idOf("PRODUCT_MANAGER")),
          decision: null,
          passedOn: null,
        },
      },
    });
    return spr;
  };

  describe("with approval limits off, as Spectra described it", () => {
    beforeAll(async () => {
      ({ t, otherId, sessions } = await groupHarness("off"));
    });
    afterAll(async () => {
      await t.close();
    });

    it("lets any one of the group decide, and refuses a second decision", async () => {
      const spr = await pendingSpr("100.00");

      expect(
        (await decide("OTHER_APPROVER", spr.recordNo, "approve")).status,
      ).toBe(200);
      expect(await statusOf(spr.orderNo)).toBe("SprApproved");

      // The first decision closes the SPR for the rest of the group.
      expect((await decide("APPROVER", spr.recordNo, "reject")).status).toBe(
        409,
      );
      expect((await sprPage(spr.recordNo)).decision).toMatchObject({
        outcome: "approved",
        by: OTHER_NAME,
      });
    });

    it("never lets the requester decide, even when they are an approver, while another approver may", async () => {
      const spr = await pendingSpr("100.00", otherId);

      expect(
        (await decide("OTHER_APPROVER", spr.recordNo, "approve")).status,
      ).toBe(403);
      expect(await statusOf(spr.orderNo)).toBe("AwaitingSpr");

      expect((await decide("APPROVER", spr.recordNo, "approve")).status).toBe(
        200,
      );
    });

    it("leaves Management out of the group, and audits the refusal", async () => {
      const spr = await pendingSpr("100.00");
      const before = (await auditEvents(t)).length;

      const res = await decide("MANAGEMENT", spr.recordNo, "approve");

      expect(res.status).toBe(403);
      expect(await statusOf(spr.orderNo)).toBe("AwaitingSpr");
      expect((await auditEvents(t)).length).toBeGreaterThan(before);
    });

    it("takes any amount, and passes nothing on", async () => {
      const spr = await pendingSpr("999999.00");

      expect((await decide("APPROVER", spr.recordNo, "approve")).status).toBe(
        200,
      );

      const page = await sprPage(spr.recordNo);
      expect(page.decision?.outcome).toBe("approved");
      expect(page.passedTo).toBeNull();
    });

    it("names the group on the SPR page, without the requester", async () => {
      const spr = await pendingSpr("100.00", otherId);

      const group = (await sprPage(spr.recordNo)).approverGroup;

      expect(group?.reason).toBeNull();
      const ids = group?.approvers.map((approver) => approver.userId) ?? [];
      expect(ids).toContain(await idOf("APPROVER"));
      expect(ids).not.toContain(otherId);
      expect(ids).not.toContain(await idOf("MANAGEMENT"));
    });

    it("hands nothing to anyone: the SPR stays with the whole group", async () => {
      const spr = await pendingSpr("100.00");
      for (const who of ["APPROVER", "OTHER_APPROVER", "MANAGEMENT"] as const) {
        const res = await call(t, as(who), "get", `${W}/tasks/handed-to-me`);
        expect(res.status).toBe(200);
        expect(handedTaskListResponseSchema.parse(res.body).data).toEqual([]);
      }
      expect(await statusOf(spr.orderNo)).toBe("AwaitingSpr");
    });
  });

  describe("with approval limits on", () => {
    beforeAll(async () => {
      ({ t, otherId, sessions } = await groupHarness("on"));
      next = 0;
      const setups = t.app.get(ApprovalSetupRepository);
      const mine = await setups.find(await idOf("APPROVER"));
      if (!mine) throw new Error("The approver has no setup");
      await setups.save({
        ...mine,
        purchaseAmountApprovalLimit: "5000.00",
        unlimitedPurchaseApproval: false,
        substituteUserId: null,
        awayFrom: null,
        awayUntil: null,
      });
      await setups.save({
        ...mine,
        userId: otherId,
        approverId: null,
        unlimitedPurchaseApproval: true,
        substituteUserId: null,
        awayFrom: null,
        awayUntil: null,
      });
    });
    afterAll(async () => {
      await t.close();
    });

    it("refuses an approver above their own limit and passes nothing on, while one whose limit covers it decides", async () => {
      const spr = await pendingSpr("5000.01");

      const refused = await decide("APPROVER", spr.recordNo, "approve");

      expect(refused.status).toBe(403);
      expect(await statusOf(spr.orderNo)).toBe("AwaitingSpr");
      const page = await sprPage(spr.recordNo);
      expect(page.passedTo).toBeNull();
      // Only the approvers whose limit covers the amount are named.
      expect(page.approverGroup?.approvers.map((a) => a.userId)).toEqual([
        otherId,
      ]);

      expect(
        (await decide("OTHER_APPROVER", spr.recordNo, "approve")).status,
      ).toBe(200);
      expect(await statusOf(spr.orderNo)).toBe("SprApproved");
    });

    it("lets an approver decide at their limit", async () => {
      const spr = await pendingSpr("5000.00");
      expect((await decide("APPROVER", spr.recordNo, "approve")).status).toBe(
        200,
      );
    });
  });
});
