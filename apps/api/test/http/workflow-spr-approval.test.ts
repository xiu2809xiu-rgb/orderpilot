import {
  IDEMPOTENCY_KEY_HEADER,
  IDEMPOTENCY_KEY_REUSED_MESSAGE,
  ROLES,
  SPR_DECISION_RECORDED_MESSAGE,
  errorEnvelopeSchema,
  type Role,
} from "@orderpilot/shared";
import { syntheticDataset } from "@orderpilot/synthetic-data";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { demoEmail } from "../../src/auth/demo-accounts.js";
import { Database } from "../../src/database/database.js";
import { OrderWorkflowService } from "../../src/modules/workflows/order-workflow.service.js";
import { SprRecordRepository } from "../../src/modules/workflows/spr-record.repository.js";
import { WorkflowCommandRepository } from "../../src/modules/workflows/workflow-command.repository.js";
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
    // Waiting means the approvers' task is open and nothing was handed back, as an undo leaves it.
    await database.client.workflowTask.updateMany({
      where: { kind: "APPROVE_SPR", instance: { orderRef: spr.orderNo } },
      data: { status: "OPEN", completedAt: null },
    });
    await database.client.workflowTask.updateMany({
      where: {
        kind: { in: ["PLACE_VENDOR_PO", "RAISE_SPR"] },
        instance: { orderRef: spr.orderNo },
      },
      data: { status: "DONE" },
    });
    return spr;
  }

  beforeAll(async () => {
    await resetTestData();
    // Area 2 routes SPRs with the approver group (ADR 0056, #251).
    t = await createTestApp({ APPROVER_GROUP: "on" });
    database = t.app.get(Database);
    for (const role of ROLES) sessions.set(role, await demoSignIn(t, role));
  });
  afterAll(async () => {
    await t.close();
  });

  it("approves an SPR, moving the order on", async () => {
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

  it("rejects an SPR, returning the order to the stock check", async () => {
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
    // The approver is made the requester after deciding: they may not undo it.
    await database.client.workflowRecord.update({
      where: { recordNo: spr.recordNo },
      data: {
        data: {
          ...(row.data as object),
          requesterUserId: await idOf("APPROVER"),
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

  it("takes a decided SPR out of the approver's inbox", async () => {
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

  it("accepts any amount while approval limits are off (ADR 0056)", async () => {
    const spr = await pendingSpr("999999.00");

    const res = await decide("APPROVER", spr.recordNo, "approve");

    expect(res.status).toBe(200);
    expect(sprDecisionResponseSchema.parse(res.body).data.message).toBe(
      SPR_DECISION_RECORDED_MESSAGE,
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

  describe("retries with an idempotency key", () => {
    let keys = 0;
    const freshKey = () => `retry-test-${String(Date.now())}-${String(++keys)}`;
    const sendWith = (
      key: string,
      role: Role,
      recordNo: string,
      action: "approve" | "reject" | "undo",
      comment = "Checked against the quote.",
    ) =>
      call(t, as(role), "post", `${W}/sprs/${recordNo}/${action}`, {
        csrf: true,
        ...(action === "undo" ? {} : { body: { comment } }),
      }).set(IDEMPOTENCY_KEY_HEADER, key);
    const audited = async (action: string, recordNo: string) =>
      (await auditEvents(t)).filter(
        (e) => e.action === action && e.entityId === recordNo,
      ).length;
    const movesTo = (orderNo: string, toStatus: string) =>
      database.client.workflowEvent.count({
        where: { instance: { orderRef: orderNo }, toStatus },
      });
    /** Every refusal anyone wrote: a copy that ran and lost would leave one. */
    const refusals = async () =>
      (await auditEvents(t)).filter((e) => e.action.endsWith(".refused"))
        .length;

    it("applies a command once when it is sent twice with the same idempotency key", async () => {
      const spr = await pendingSpr("100.00");
      const key = freshKey();
      const moves = await movesTo(spr.orderNo, "SprApproved");
      const audits = await audited("workflows.spr.approved", spr.recordNo);

      const first = await sendWith(key, "APPROVER", spr.recordNo, "approve");
      const second = await sendWith(key, "APPROVER", spr.recordNo, "approve");

      expect(first.status).toBe(200);
      expect(second.status).toBe(200);
      expect(await statusOf(spr.orderNo)).toBe("SprApproved");
      expect((await movesTo(spr.orderNo, "SprApproved")) - moves).toBe(1);
      expect(
        (await audited("workflows.spr.approved", spr.recordNo)) - audits,
      ).toBe(1);
    });

    it("returns the first result for a repeated key, without running it again", async () => {
      const spr = await pendingSpr("100.00");
      const key = freshKey();
      const first = await sendWith(key, "APPROVER", spr.recordNo, "approve");
      expect(first.status).toBe(200);
      const undo = await sendWith(freshKey(), "APPROVER", spr.recordNo, "undo");
      expect(undo.status).toBe(200);

      const repeat = await sendWith(key, "APPROVER", spr.recordNo, "approve");

      expect(repeat.status).toBe(200);
      expect(repeat.body).toEqual(first.body);
      // The repeat answered from memory: the undone order still waits.
      expect(await statusOf(spr.orderNo)).toBe("AwaitingSpr");
    });

    it("answers a repeat from what it kept, running none of the command again", async () => {
      const spr = await pendingSpr("100.00");
      const key = freshKey();
      const first = await sendWith(key, "APPROVER", spr.recordNo, "approve");
      expect(first.status).toBe(200);
      await sendWith(freshKey(), "APPROVER", spr.recordNo, "undo");
      // Running it again would now be refused, and a refusal is audited.
      const row = await database.client.workflowRecord.findUniqueOrThrow({
        where: { recordNo: spr.recordNo },
      });
      await database.client.workflowRecord.update({
        where: { recordNo: spr.recordNo },
        data: {
          data: {
            ...(row.data as object),
            requesterUserId: await idOf("APPROVER"),
          },
        },
      });
      const refusals = await audited("workflows.spr.refused", spr.recordNo);

      const repeat = await sendWith(key, "APPROVER", spr.recordNo, "approve");

      expect(repeat.status).toBe(200);
      expect(repeat.body).toEqual(first.body);
      expect(await audited("workflows.spr.refused", spr.recordNo)).toBe(
        refusals,
      );
    });

    it("runs once when the same key arrives twice at the same moment", async () => {
      const spr = await pendingSpr("100.00");
      const key = freshKey();
      const moves = await movesTo(spr.orderNo, "SprApproved");
      const refused = await refusals();

      const [a, b] = await Promise.all([
        sendWith(key, "APPROVER", spr.recordNo, "approve"),
        sendWith(key, "APPROVER", spr.recordNo, "approve"),
      ]);

      expect([a.status, b.status]).toEqual([200, 200]);
      expect(b.body).toEqual(a.body);
      expect((await movesTo(spr.orderNo, "SprApproved")) - moves).toBe(1);
      expect(await refusals()).toBe(refused);
    });

    it("undoes once when the same key arrives twice at the same moment", async () => {
      const spr = await pendingSpr("100.00");
      await decide("APPROVER", spr.recordNo, "approve");
      const key = freshKey();
      const moves = await movesTo(spr.orderNo, "AwaitingSpr");
      const refused = await refusals();

      const [a, b] = await Promise.all([
        sendWith(key, "APPROVER", spr.recordNo, "undo"),
        sendWith(key, "APPROVER", spr.recordNo, "undo"),
      ]);

      expect([a.status, b.status]).toEqual([200, 200]);
      expect(b.body).toEqual(a.body);
      expect(await statusOf(spr.orderNo)).toBe("AwaitingSpr");
      expect((await movesTo(spr.orderNo, "AwaitingSpr")) - moves).toBe(1);
      expect(await refusals()).toBe(refused);
    });

    it("refuses the same key for a different request, and changes nothing", async () => {
      const spr = await pendingSpr("100.00");
      const other = await pendingSpr("100.00");
      const key = freshKey();
      await sendWith(key, "APPROVER", spr.recordNo, "approve");

      const otherOutcome = await sendWith(
        key,
        "APPROVER",
        spr.recordNo,
        "reject",
      );
      const otherComment = await sendWith(
        key,
        "APPROVER",
        spr.recordNo,
        "approve",
        "A different comment",
      );
      const otherSpr = await sendWith(
        key,
        "APPROVER",
        other.recordNo,
        "approve",
      );

      for (const res of [otherOutcome, otherComment, otherSpr]) {
        expect(res.status).toBe(409);
        expect(errorEnvelopeSchema.parse(res.body).error.message).toBe(
          IDEMPOTENCY_KEY_REUSED_MESSAGE,
        );
      }
      expect(await statusOf(spr.orderNo)).toBe("SprApproved");
      expect(await statusOf(other.orderNo)).toBe("AwaitingSpr");
    });

    it("keeps each person's keys apart, even for the same request", async () => {
      const spr = await pendingSpr("100.00");
      const key = freshKey();
      const decided = await sendWith(key, "APPROVER", spr.recordNo, "approve");
      expect(decided.status).toBe(200);

      // Not a replay of the approver's 200: Management's own request runs, and
      // is refused, because the SPR already has a decision.
      const res = await sendWith(key, "MANAGEMENT", spr.recordNo, "approve");

      expect(res.status).toBe(409);
      expect(await statusOf(spr.orderNo)).toBe("SprApproved");
    });

    it("replays a rejection as well", async () => {
      const spr = await pendingSpr("100.00");
      const key = freshKey();

      const first = await sendWith(key, "APPROVER", spr.recordNo, "reject");
      const second = await sendWith(key, "APPROVER", spr.recordNo, "reject");

      expect(first.status).toBe(200);
      expect(second.status).toBe(200);
      expect(second.body).toEqual(first.body);
      expect(await statusOf(spr.orderNo)).toBe("StockChecked");
    });

    it("undoes once, however often the undo is sent", async () => {
      const spr = await pendingSpr("100.00");
      await decide("APPROVER", spr.recordNo, "approve");
      const key = freshKey();
      const audits = await audited(
        "workflows.spr.decision-undone",
        spr.recordNo,
      );

      const first = await sendWith(key, "APPROVER", spr.recordNo, "undo");
      const second = await sendWith(key, "APPROVER", spr.recordNo, "undo");

      expect(first.status).toBe(200);
      expect(second.status).toBe(200);
      expect(second.body).toEqual(first.body);
      expect(await statusOf(spr.orderNo)).toBe("AwaitingSpr");
      expect(
        (await audited("workflows.spr.decision-undone", spr.recordNo)) - audits,
      ).toBe(1);
    });

    it("still refuses and audits a request that was refused, every time", async () => {
      const spr = await pendingSpr("10.00", {
        requesterUserId: await idOf("APPROVER"),
      });
      const key = freshKey();
      const audits = await audited("workflows.spr.refused", spr.recordNo);

      const first = await sendWith(key, "APPROVER", spr.recordNo, "approve");
      const second = await sendWith(key, "APPROVER", spr.recordNo, "approve");

      expect(first.status).toBe(403);
      expect(second.status).toBe(403);
      expect(
        (await audited("workflows.spr.refused", spr.recordNo)) - audits,
      ).toBe(2);
      expect(
        await database.client.workflowCommand.count({ where: { key } }),
      ).toBe(0);
    });

    it("refuses both copies of a refused request sent at the same moment, auditing each", async () => {
      const spr = await pendingSpr("10.00", {
        requesterUserId: await idOf("APPROVER"),
      });
      const key = freshKey();
      const audits = await audited("workflows.spr.refused", spr.recordNo);

      const [a, b] = await Promise.all([
        sendWith(key, "APPROVER", spr.recordNo, "approve"),
        sendWith(key, "APPROVER", spr.recordNo, "approve"),
      ]);

      expect([a.status, b.status]).toEqual([403, 403]);
      expect(
        (await audited("workflows.spr.refused", spr.recordNo)) - audits,
      ).toBe(2);
      expect(
        await database.client.workflowCommand.count({ where: { key } }),
      ).toBe(0);
    });

    it("rolls a command back when its claim was taken over before it kept its answer", async () => {
      const commands = t.app.get(WorkflowCommandRepository);
      const spr = await pendingSpr("100.00");
      const claimId = await commands.claim(
        {
          actorUserId: await idOf("APPROVER"),
          key: freshKey(),
          command: "spr.approve",
          requestHash: "a request",
        },
        new Date(),
      );
      if (!claimId) throw new Error("The key was not claimed");
      // As a later copy does when it takes over an abandoned claim.
      await commands.release(claimId);

      await expect(
        database.transaction(async () => {
          await database.client.workflowRecord.update({
            where: { recordNo: spr.recordNo },
            data: { navisionNo: "TAKEN-OVER" },
          });
          await commands.complete(claimId, { said: "late" }, new Date());
        }),
      ).rejects.toThrow("a retry took it over");
      const row = await database.client.workflowRecord.findUniqueOrThrow({
        where: { recordNo: spr.recordNo },
      });
      expect(row.navisionNo).not.toBe("TAKEN-OVER");
    });

    it("answers a repeat without a key as before: it is refused, and nothing is kept", async () => {
      const spr = await pendingSpr("100.00");
      const kept = await database.client.workflowCommand.count();
      await decide("APPROVER", spr.recordNo, "approve");

      const again = await decide("APPROVER", spr.recordNo, "approve");

      expect(again.status).toBe(409);
      expect(await database.client.workflowCommand.count()).toBe(kept);
    });

    it("refuses a key that is not a key, before doing anything", async () => {
      const spr = await pendingSpr("100.00");

      for (const key of ["short12", "has spaces in it", "x".repeat(101)]) {
        const res = await sendWith(key, "APPROVER", spr.recordNo, "approve");
        expect(res.status).toBe(400);
        expect(errorEnvelopeSchema.parse(res.body).error.code).toBe(
          "VALIDATION_FAILED",
        );
      }
      // A header sent twice reaches the API as both values joined by a comma.
      const twice = await sendWith(
        `${freshKey()}, ${freshKey()}`,
        "APPROVER",
        spr.recordNo,
        "approve",
      );
      expect(twice.status).toBe(400);
      expect(await statusOf(spr.orderNo)).toBe("AwaitingSpr");
    });

    it("accepts the shortest and the longest key", async () => {
      const short = await pendingSpr("100.00");
      const long = await pendingSpr("100.00");
      const stamp = String(Date.now());

      const eight = await sendWith(
        stamp.slice(-8),
        "APPROVER",
        short.recordNo,
        "approve",
      );
      const hundred = await sendWith(
        stamp.padStart(100, "k"),
        "APPROVER",
        long.recordNo,
        "approve",
      );

      expect(eight.status).toBe(200);
      expect(hundred.status).toBe(200);
    });
  });

  it("keeps the audit chain whole", async () => {
    const report = await t.app.get(AuditService).verify();
    expect(report.ok).toBe(true);
  });
});
