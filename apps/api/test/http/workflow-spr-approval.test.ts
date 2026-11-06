import {
  ROLES,
  SPR_DECISION_RECORDED_MESSAGE,
  SPR_PASSED_ON_MESSAGE,
  type Role,
} from "@orderpilot/shared";
import { syntheticDataset } from "@orderpilot/synthetic-data";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { demoEmail } from "../../src/auth/demo-accounts.js";
import { Database } from "../../src/database/database.js";
import { ApprovalSetupRepository } from "../../src/modules/governance/approval-setup.repository.js";
import { OrderWorkflowService } from "../../src/modules/workflows/order-workflow.service.js";
import { SprRecordRepository } from "../../src/modules/workflows/spr-record.repository.js";
import {
  sprDecisionResponseSchema,
  sprResponseSchema,
} from "../../src/modules/workflows/workflows.schemas.js";
import { AuditService } from "../../src/audit/audit.service.js";
import { UserRepository } from "../../src/users/user.repository.js";
import {
  API,
  auditEvents,
  call,
  demoSignIn,
  type Browser,
} from "../support/auth.js";
import { resetTestData } from "../support/reset.js";
import { createTestApp, type TestApp } from "../support/test-app.js";

const W = `${API}/workflows`;
const MANAGEMENT_APPROVES = `${API}/governance/matrix/MANAGEMENT/permissions/approvals.decide`;

const PENDING = syntheticDataset().sprs.filter((s) => s.status === "submitted");
const SUGGESTED = syntheticDataset().sprs.find((s) => s.status === "suggested");

describe("SPR approval within limits (C-3), on the real state machine and area 4's real policy", () => {
  let t: TestApp;
  let database: Database;
  const sessions = new Map<Role, Browser>();
  let nextPending = 0;

  const as = (role: Role): Browser => {
    const browser = sessions.get(role);
    if (!browser) throw new Error(`No session for ${role}`);
    return browser;
  };
  const decide = (
    role: Role,
    recordNo: string,
    action: "approve" | "reject",
    comment = "Checked against the quote.",
  ) =>
    call(t, as(role), "post", `${W}/sprs/${recordNo}/${action}`, {
      csrf: true,
      body: { comment },
    });
  const statusOf = async (orderNo: string) =>
    (await t.app.get(OrderWorkflowService).statusOf(orderNo))?.status;
  const idOf = async (role: Role): Promise<string> => {
    const user = await t.app.get(UserRepository).findByEmail(demoEmail(role));
    if (!user) throw new Error(`No demo user for ${role}`);
    return user.id;
  };

  /**
   * A seeded SPR waiting for a decision, at this amount. The dataset has only so
   * many, and a test uses one up, so each is put back before it is used again.
   */
  async function pendingSpr(amount: string, changes: object = {}) {
    const spr = PENDING[nextPending % PENDING.length];
    nextPending += 1;
    if (!spr) throw new Error("The dataset has no pending SPRs");
    const row = await database.client.workflowRecord.findUniqueOrThrow({
      where: { recordNo: spr.recordNo },
    });
    await database.client.workflowRecord.update({
      where: { recordNo: spr.recordNo },
      data: {
        data: {
          ...(row.data as object),
          amount,
          requesterUserId: await idOf("PRODUCT_MANAGER"),
          decision: null,
          passedOn: null,
          ...changes,
        },
      },
    });
    await database.client.workflowInstance.updateMany({
      where: { orderRef: spr.orderNo },
      data: { status: "AwaitingSpr" },
    });
    return spr;
  }

  const approver = async () =>
    t.app.get(ApprovalSetupRepository).find(await idOf("APPROVER"));

  /** Changes the approver's setup for one test, and always puts it back. */
  async function withApprover(
    changes: object,
    work: () => Promise<void>,
  ): Promise<void> {
    const before = await approver();
    if (!before) throw new Error("The approver has no setup");
    const setups = t.app.get(ApprovalSetupRepository);
    await setups.save({ ...before, ...changes });
    try {
      await work();
    } finally {
      await setups.save(before);
    }
  }

  /** ADR 0041 leaves Management's permission to Richie, so a test grants it for itself. */
  async function withManagementDeciding(work: () => Promise<void>) {
    const grant = (granted: boolean) =>
      call(t, as("SYSTEM_ADMIN"), "put", MANAGEMENT_APPROVES, {
        csrf: true,
        body: { granted },
      });
    expect((await grant(true)).status).toBe(200);
    try {
      await work();
    } finally {
      await grant(false);
    }
  }

  beforeAll(async () => {
    await resetTestData();
    t = await createTestApp();
    database = t.app.get(Database);
    for (const role of ROLES) sessions.set(role, await demoSignIn(t, role));
  });
  afterAll(async () => {
    await t.close();
  });

  it("approves an SPR whose amount is within the approver's purchase limit", async () => {
    const spr = await pendingSpr("4999.99");
    expect(await statusOf(spr.orderNo)).toBe("AwaitingSpr");

    const res = await decide("APPROVER", spr.recordNo, "approve");

    expect(res.status).toBe(200);
    const body = sprDecisionResponseSchema.parse(res.body);
    expect(body.data).toMatchObject({
      applied: true,
      message: SPR_DECISION_RECORDED_MESSAGE,
      outcome: "approved",
    });
    expect(await statusOf(spr.orderNo)).toBe("SprApproved");
  });

  it("approves exactly at the limit", async () => {
    const spr = await pendingSpr("5000.00");

    const res = await decide("APPROVER", spr.recordNo, "approve");

    expect(res.status).toBe(200);
    expect(await statusOf(spr.orderNo)).toBe("SprApproved");
  });

  it("keeps the comment with the decision and the person who made it", async () => {
    const spr = await pendingSpr("100.00");

    await decide("APPROVER", spr.recordNo, "approve", "Quote attached.");

    const shown = await call(
      t,
      as("APPROVER"),
      "get",
      `${W}/sprs/${spr.recordNo}`,
    );
    const { decision } = sprResponseSchema.parse(shown.body).data;
    expect(decision).toMatchObject({
      outcome: "approved",
      comment: "Quote attached.",
    });
    expect(decision?.by).toBeTruthy();

    const events = await auditEvents(t);
    expect(
      events.filter((e) => e.entityId === spr.recordNo).map((e) => e.action),
    ).toContain("workflows.spr.approved");
    expect(
      events.filter((e) => e.entityId === spr.orderNo).map((e) => e.action),
    ).toContain("workflow.transition");
  });

  it("rejects within the limit, returning the order to the stock check", async () => {
    const spr = await pendingSpr("100.00");

    const res = await decide(
      "APPROVER",
      spr.recordNo,
      "reject",
      "Wrong vendor",
    );

    expect(res.status).toBe(200);
    expect(await statusOf(spr.orderNo)).toBe("StockChecked");
  });

  it("undoes a decision, so it can be decided again", async () => {
    const spr = await pendingSpr("100.00");
    await decide("APPROVER", spr.recordNo, "approve");

    const undo = await call(
      t,
      as("APPROVER"),
      "post",
      `${W}/sprs/${spr.recordNo}/undo`,
      { csrf: true },
    );

    expect(undo.status).toBe(200);
    expect(await statusOf(spr.orderNo)).toBe("AwaitingSpr");
    const again = await decide("APPROVER", spr.recordNo, "reject", "Too dear");
    expect(again.status).toBe(200);
    expect(await statusOf(spr.orderNo)).toBe("StockChecked");
  });

  it("sends an SPR above the approver's limit to the next approver, and never approves it below", async () => {
    const spr = await pendingSpr("5000.01");

    const res = await decide("APPROVER", spr.recordNo, "approve");

    expect(res.status).toBe(200);
    const body = sprDecisionResponseSchema.parse(res.body);
    expect(body.data.message).toBe(SPR_PASSED_ON_MESSAGE);
    const names = await t.app
      .get(UserRepository)
      .namesByIds([await idOf("MANAGEMENT")]);
    expect(body.data.passedToName).toBe(names.get(await idOf("MANAGEMENT")));
    expect(await statusOf(spr.orderNo)).toBe("AwaitingSpr");

    const shown = await call(
      t,
      as("APPROVER"),
      "get",
      `${W}/sprs/${spr.recordNo}`,
    );
    const detail = sprResponseSchema.parse(shown.body).data;
    expect(detail.decision).toBeNull();
    expect(detail.passedTo?.name).toBe(body.data.passedToName);

    // It is out of their hands now: asking again is refused, not passed on again.
    const again = await decide("APPROVER", spr.recordNo, "approve");
    expect(again.status).toBe(403);
    expect(await statusOf(spr.orderNo)).toBe("AwaitingSpr");

    await withManagementDeciding(async () => {
      const decided = await decide("MANAGEMENT", spr.recordNo, "approve");
      expect(decided.status).toBe(200);
      expect(await statusOf(spr.orderNo)).toBe("SprApproved");
    });
  });

  it("passes on a rejection above the limit too, for someone with authority to decide", async () => {
    const spr = await pendingSpr("9000.00");

    const res = await decide("APPROVER", spr.recordNo, "reject", "Too dear");

    expect(sprDecisionResponseSchema.parse(res.body).data.message).toBe(
      SPR_PASSED_ON_MESSAGE,
    );
    expect(await statusOf(spr.orderNo)).toBe("AwaitingSpr");
    const row = await database.client.workflowRecord.findUniqueOrThrow({
      where: { recordNo: spr.recordNo },
    });
    // Nothing was decided, but what they asked for and why is not lost.
    expect(row.data).toMatchObject({
      decision: null,
      passedOn: { outcome: "rejected", comment: "Too dear" },
    });
  });

  it("says plainly when nobody above can take it, and changes nothing", async () => {
    const spr = await pendingSpr("9000.00");

    await withApprover({ approverId: null }, async () => {
      const res = await decide("APPROVER", spr.recordNo, "approve");
      expect(res.status).toBe(409);
    });

    const shown = await call(
      t,
      as("APPROVER"),
      "get",
      `${W}/sprs/${spr.recordNo}`,
    );
    expect(sprResponseSchema.parse(shown.body).data.passedTo).toBeNull();
  });

  it("will not pass an SPR on to the person who raised it", async () => {
    // Management raised it, and it has already come along the chain to the approver,
    // whose own next step is Management.
    const spr = await pendingSpr("9000.00", {
      requesterUserId: await idOf("MANAGEMENT"),
      passedOn: {
        byUserId: await idOf("PRODUCT_MANAGER"),
        byName: "Test Product Manager",
        toName: "Test Approver",
        outcome: "approved",
        comment: "Over my limit",
        at: new Date().toISOString(),
      },
    });

    const res = await decide("APPROVER", spr.recordNo, "approve");

    expect(res.status).toBe(409);
    expect(await statusOf(spr.orderNo)).toBe("AwaitingSpr");
  });

  it("will not pass a substitute's SPR back to the substitute", async () => {
    const spr = await pendingSpr("9000.00");
    const management = await idOf("MANAGEMENT");
    const setups = t.app.get(ApprovalSetupRepository);
    const own = await setups.find(management);
    if (!own) throw new Error("Management has no setup");

    // Management stands in for the approver, and is also who the approver escalates to.
    await setups.save({ ...own, unlimitedPurchaseApproval: false });
    try {
      await withApprover(
        {
          substituteUserId: management,
          awayFrom: new Date(Date.now() - 60_000),
          awayUntil: new Date(Date.now() + 3_600_000),
        },
        () =>
          withManagementDeciding(async () => {
            const res = await decide("MANAGEMENT", spr.recordNo, "approve");
            expect(res.status).toBe(409);
          }),
      );
    } finally {
      await setups.save(own);
    }
    expect(await statusOf(spr.orderNo)).toBe("AwaitingSpr");
  });

  it("shows the next person what was asked and why", async () => {
    const spr = await pendingSpr("9000.00");
    await decide("APPROVER", spr.recordNo, "reject", "Too dear");

    const res = await call(
      t,
      as("MANAGEMENT"),
      "get",
      `${W}/sprs/${spr.recordNo}`,
    );

    expect(sprResponseSchema.parse(res.body).data.passedTo).toMatchObject({
      askedOutcome: "rejected",
      comment: "Too dear",
    });
  });

  it("tells the person it was passed to that they decide, and nobody else", async () => {
    const spr = await pendingSpr("9000.00");
    await decide("APPROVER", spr.recordNo, "approve");
    const seen = async (role: Role) => {
      const res = await call(t, as(role), "get", `${W}/sprs/${spr.recordNo}`);
      return sprResponseSchema.parse(res.body).data.passedTo?.youDecide;
    };

    expect(await seen("APPROVER")).toBe(false);
    await withManagementDeciding(async () => {
      expect(await seen("MANAGEMENT")).toBe(true);
    });
  });

  it("finds an SPR through its order after the dataset's numbers have moved to a new day", async () => {
    const spr = await pendingSpr("100.00");
    // What a later day does: the record keeps the number it was first written with.
    await database.client.workflowRecord.update({
      where: { recordNo: spr.recordNo },
      data: { recordNo: "SPR-20200101-0001" },
    });

    const res = await decide("APPROVER", spr.recordNo, "approve");

    expect(res.status).toBe(200);
    expect(await statusOf(spr.orderNo)).toBe("SprApproved");
    await database.client.workflowRecord.update({
      where: { recordNo: "SPR-20200101-0001" },
      data: { recordNo: spr.recordNo },
    });
  });

  it("says a sample the workflow does not run cannot be decided, before anyone tries", async () => {
    if (!SUGGESTED) throw new Error("The dataset has no suggested SPR");
    const res = await call(
      t,
      as("APPROVER"),
      "get",
      `${W}/sprs/${SUGGESTED.recordNo}`,
    );
    expect(sprResponseSchema.parse(res.body).data.decidable).toBe(false);
  });

  it("does not let the requester undo a decision on their own SPR", async () => {
    const spr = await pendingSpr("100.00");
    await decide("APPROVER", spr.recordNo, "approve");
    const row = await database.client.workflowRecord.findUniqueOrThrow({
      where: { recordNo: spr.recordNo },
    });
    // With the SPR passed along, the route rule follows the passer and would allow
    // this, so only the check on the original requester can stop it.
    await database.client.workflowRecord.update({
      where: { recordNo: spr.recordNo },
      data: {
        data: {
          ...(row.data as object),
          requesterUserId: await idOf("APPROVER"),
          passedOn: {
            byUserId: await idOf("PRODUCT_MANAGER"),
            byName: "Test Product Manager",
            toName: "Test Approver",
            outcome: "approved",
            comment: "Over my limit",
            at: new Date().toISOString(),
          },
        },
      },
    });

    const undo = await call(
      t,
      as("APPROVER"),
      "post",
      `${W}/sprs/${spr.recordNo}/undo`,
      { csrf: true },
    );

    expect(undo.status).toBe(403);
    expect(await statusOf(spr.orderNo)).toBe("SprApproved");
  });

  it("will not pass on an SPR whose order is no longer waiting for a decision", async () => {
    const spr = await pendingSpr("9000.00");
    await database.client.workflowInstance.updateMany({
      where: { orderRef: spr.orderNo },
      data: { status: "OnHold" },
    });

    const res = await decide("APPROVER", spr.recordNo, "approve");

    expect(res.status).toBe(409);
    const row = await database.client.workflowRecord.findUniqueOrThrow({
      where: { recordNo: spr.recordNo },
    });
    expect(row.data).toMatchObject({ passedOn: null });
  });

  it("does not overwrite a newer change from a stale read", async () => {
    const spr = await pendingSpr("100.00");
    const records = t.app.get(SprRecordRepository);
    const stale = await records.findByOrder(spr.orderNo);
    if (!stale) throw new Error("No record");
    await new Promise((resolve) => setTimeout(resolve, 5));
    await records.save(stale, { amount: "200.00" });

    await expect(records.save(stale, { amount: "300.00" })).rejects.toThrow(
      "Someone else",
    );
    expect((await records.findByOrder(spr.orderNo))?.amount).toBe("200.00");
  });

  it("stops at Management until Richie decides whether it holds the permission (ADR 0041)", async () => {
    const spr = await pendingSpr("9000.00");
    await decide("APPROVER", spr.recordNo, "approve");

    const res = await decide("MANAGEMENT", spr.recordNo, "approve");

    expect(res.status).toBe(403);
    expect(await statusOf(spr.orderNo)).toBe("AwaitingSpr");
  });

  it("takes an SPR it passed on out of the approver's inbox", async () => {
    const spr = await pendingSpr("9000.00");
    const task = syntheticDataset().tasks.find(
      (entry) =>
        entry.kind === "APPROVE_SPR" && entry.ref?.recordNo === spr.recordNo,
    );
    const inbox = async () => {
      const res = await call(
        t,
        as("APPROVER"),
        "get",
        `${W}/tasks?kind=APPROVE_SPR&pageSize=100`,
      );
      return (res.body as { data: { id: string }[] }).data.map((e) => e.id);
    };
    expect(task).toBeDefined();
    expect(await inbox()).toContain(task?.id);

    await decide("APPROVER", spr.recordNo, "approve");

    expect(await inbox()).not.toContain(task?.id);
  });

  it("accepts any amount from an approver with unlimited purchase approval", async () => {
    const spr = await pendingSpr("999999.00");

    await withApprover({ unlimitedPurchaseApproval: true }, async () => {
      const res = await decide("APPROVER", spr.recordNo, "approve");
      expect(res.status).toBe(200);
      expect(sprDecisionResponseSchema.parse(res.body).data.message).toBe(
        SPR_DECISION_RECORDED_MESSAGE,
      );
    });
    expect(await statusOf(spr.orderNo)).toBe("SprApproved");
  });

  it("passes the SPR to the substitute while the approver is away", async () => {
    const spr = await pendingSpr("100.00");
    const management = await idOf("MANAGEMENT");

    // With no Approver ID, only the substitute branch of the chain can name them.
    await withApprover(
      {
        approverId: null,
        substituteUserId: management,
        awayFrom: new Date(Date.now() - 60_000),
        awayUntil: new Date(Date.now() + 3_600_000),
      },
      () =>
        withManagementDeciding(async () => {
          const absent = await decide("APPROVER", spr.recordNo, "approve");
          expect(absent.status).toBe(403);
          expect(await statusOf(spr.orderNo)).toBe("AwaitingSpr");

          const res = await decide("MANAGEMENT", spr.recordNo, "approve");
          expect(res.status).toBe(200);
        }),
    );
    expect(await statusOf(spr.orderNo)).toBe("SprApproved");
  });

  it("refuses a requester approving their own SPR, audits it, and leaves the order waiting", async () => {
    const spr = await pendingSpr("10.00", {
      requesterUserId: await idOf("APPROVER"),
    });

    const res = await decide("APPROVER", spr.recordNo, "approve");

    expect(res.status).toBe(403);
    expect(await statusOf(spr.orderNo)).toBe("AwaitingSpr");
    const events = await auditEvents(t);
    expect(
      events.filter((e) => e.entityId === spr.recordNo).map((e) => e.action),
    ).toContain("workflows.spr.refused");
  });

  it("says a decided SPR needs an Undo before it can be decided again", async () => {
    const spr = await pendingSpr("100.00");
    await decide("APPROVER", spr.recordNo, "approve");

    const res = await decide(
      "APPROVER",
      spr.recordNo,
      "reject",
      "Changed my mind",
    );

    expect(res.status).toBe(409);
    expect(
      (res.body as { error: { message: string } }).error.message,
    ).toContain("Undo");
    expect(await statusOf(spr.orderNo)).toBe("SprApproved");
  });

  it("refuses a decision on a sample the workflow does not run", async () => {
    if (!SUGGESTED) throw new Error("The dataset has no suggested SPR");

    const res = await decide("APPROVER", SUGGESTED.recordNo, "approve");

    expect(res.status).toBe(409);
  });

  it("keeps the audit chain whole", async () => {
    const report = await t.app.get(AuditService).verify();
    expect(report.ok).toBe(true);
  });
});
