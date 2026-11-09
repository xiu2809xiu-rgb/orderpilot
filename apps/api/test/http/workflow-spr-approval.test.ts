import {
  IDEMPOTENCY_KEY_HEADER,
  IDEMPOTENCY_KEY_REUSED_MESSAGE,
  ROLES,
  SPR_DECISION_RECORDED_MESSAGE,
  SPR_PASSED_ON_MESSAGE,
  errorEnvelopeSchema,
  type Role,
} from "@orderpilot/shared";
import { syntheticDataset } from "@orderpilot/synthetic-data";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { demoEmail } from "../../src/auth/demo-accounts.js";
import { Database } from "../../src/database/database.js";
import { ApprovalSetupRepository } from "../../src/modules/governance/approval-setup.repository.js";
import { OrderWorkflowService } from "../../src/modules/workflows/order-workflow.service.js";
import { SprRecordRepository } from "../../src/modules/workflows/spr-record.repository.js";
import { WorkflowCommandRepository } from "../../src/modules/workflows/workflow-command.repository.js";
import {
  handedTaskListResponseSchema,
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

  /**
   * Management holds approvals.decide in the default matrix (ADR 0041), so a
   * test of a role that cannot decide takes the permission away for itself.
   */
  async function withoutManagementDeciding(work: () => Promise<void>) {
    const grant = (granted: boolean) =>
      call(t, as("SYSTEM_ADMIN"), "put", MANAGEMENT_APPROVES, {
        csrf: true,
        body: { granted },
      });
    expect((await grant(false)).status).toBe(200);
    try {
      await work();
    } finally {
      await grant(true);
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

    const decided = await decide("MANAGEMENT", spr.recordNo, "approve");
    expect(decided.status).toBe(200);
    expect(await statusOf(spr.orderNo)).toBe("SprApproved");
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
        async () => {
          const res = await decide("MANAGEMENT", spr.recordNo, "approve");
          expect(res.status).toBe(409);
        },
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
    expect(await seen("MANAGEMENT")).toBe(true);
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

  it("stops at Management while its role cannot decide (ADR 0041)", async () => {
    const spr = await pendingSpr("9000.00");
    await decide("APPROVER", spr.recordNo, "approve");

    await withoutManagementDeciding(async () => {
      const res = await decide("MANAGEMENT", spr.recordNo, "approve");

      expect(res.status).toBe(403);
      expect(await statusOf(spr.orderNo)).toBe("AwaitingSpr");
    });
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
      async () => {
        const absent = await decide("APPROVER", spr.recordNo, "approve");
        expect(absent.status).toBe(403);
        expect(await statusOf(spr.orderNo)).toBe("AwaitingSpr");

        const res = await decide("MANAGEMENT", spr.recordNo, "approve");
        expect(res.status).toBe(200);
      },
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

  describe("who receives an SPR", () => {
    const handedTo = async (role: Role, query = "pageSize=100") => {
      const res = await call(
        t,
        as(role),
        "get",
        `${W}/tasks/handed-to-me?${query}`,
      );
      expect(res.status).toBe(200);
      return handedTaskListResponseSchema.parse(res.body);
    };
    const handedFor = async (role: Role, recordNo: string) =>
      (await handedTo(role)).data.find(
        (task) => task.ref?.recordNo === recordNo,
      );
    const approverInbox = async () => {
      const res = await call(
        t,
        as("APPROVER"),
        "get",
        `${W}/tasks?kind=APPROVE_SPR&pageSize=100`,
      );
      return (
        res.body as { data: { ref: { recordNo: string } | null }[] }
      ).data.map((task) => task.ref?.recordNo);
    };
    /** An SPR the approver's inbox really shows, so a later absence means something. */
    const waiting = async (amount: string) => {
      const spr = await pendingSpr(amount);
      expect(await approverInbox()).toContain(spr.recordNo);
      return spr;
    };
    const away = {
      awayFrom: new Date(Date.now() - 60_000),
      awayUntil: new Date(Date.now() + 3_600_000),
    };

    it("gives the SPR to the substitute while the approver is away, and back when they return", async () => {
      const spr = await waiting("100.00");
      const management = await idOf("MANAGEMENT");
      expect(await approverInbox()).toContain(spr.recordNo);
      expect(await handedFor("MANAGEMENT", spr.recordNo)).toBeUndefined();

      await withApprover(
        { substituteUserId: management, ...away },
        async () => {
          expect(await approverInbox()).not.toContain(spr.recordNo);
          expect(await handedFor("MANAGEMENT", spr.recordNo)).toMatchObject({
            kind: "APPROVE_SPR",
            orderNo: spr.orderNo,
            handedOver: { reason: "substitute", fromName: "Janet Lim" },
          });
        },
      );

      expect(await approverInbox()).toContain(spr.recordNo);
      expect(await handedFor("MANAGEMENT", spr.recordNo)).toBeUndefined();
    });

    it("gives it to the person the approver escalates to when there is no substitute", async () => {
      const spr = await waiting("100.00");

      await withApprover({ substituteUserId: null, ...away }, async () => {
        expect(await approverInbox()).not.toContain(spr.recordNo);
        expect(await handedFor("MANAGEMENT", spr.recordNo)).toMatchObject({
          handedOver: { reason: "escalated", fromName: "Janet Lim" },
        });
      });
    });

    it("gives an SPR above the limit to the next approver, saying who passed it on", async () => {
      const spr = await waiting("9000.00");

      await decide("APPROVER", spr.recordNo, "approve");

      expect(await approverInbox()).not.toContain(spr.recordNo);
      expect(await handedFor("MANAGEMENT", spr.recordNo)).toMatchObject({
        handedOver: { reason: "passed-on", fromName: "Janet Lim" },
      });
    });

    it("takes the task away once the person it went to has decided", async () => {
      const spr = await waiting("9000.00");
      await decide("APPROVER", spr.recordNo, "approve");

      expect((await decide("MANAGEMENT", spr.recordNo, "approve")).status).toBe(
        200,
      );

      expect(await handedFor("MANAGEMENT", spr.recordNo)).toBeUndefined();
      expect(await approverInbox()).not.toContain(spr.recordNo);
    });

    it("says whether the person can act, as area 4's policy would answer", async () => {
      const spr = await waiting("9000.00");
      await decide("APPROVER", spr.recordNo, "approve");

      await withoutManagementDeciding(async () => {
        expect(await handedFor("MANAGEMENT", spr.recordNo)).toMatchObject({
          handedOver: { canAct: false },
        });
      });
      expect(await handedFor("MANAGEMENT", spr.recordNo)).toMatchObject({
        handedOver: { canAct: true },
      });
    });

    it("lets a substitute with the permission really decide what they received", async () => {
      const spr = await waiting("100.00");

      await withApprover(
        { substituteUserId: await idOf("MANAGEMENT"), ...away },
        async () => {
          expect(await handedFor("MANAGEMENT", spr.recordNo)).toMatchObject({
            handedOver: { canAct: true },
          });
          const res = await decide("MANAGEMENT", spr.recordNo, "approve");
          expect(res.status).toBe(200);
          expect(await handedFor("MANAGEMENT", spr.recordNo)).toBeUndefined();
        },
      );
      expect(await statusOf(spr.orderNo)).toBe("SprApproved");
    });

    it("tells a substitute whose role cannot decide, rather than leaving a dead task", async () => {
      const spr = await waiting("100.00");

      await withApprover(
        { substituteUserId: await idOf("MANAGEMENT"), ...away },
        () =>
          withoutManagementDeciding(async () => {
            expect(await handedFor("MANAGEMENT", spr.recordNo)).toMatchObject({
              handedOver: { reason: "substitute", canAct: false },
            });
          }),
      );
    });

    it("counts a person above their own limit as able to act, because deciding tries to pass it on", async () => {
      const spr = await waiting("9000.00");
      const management = await idOf("MANAGEMENT");
      const setups = t.app.get(ApprovalSetupRepository);
      const own = await setups.find(management);
      if (!own) throw new Error("Management has no setup");
      await decide("APPROVER", spr.recordNo, "approve");

      await setups.save({
        ...own,
        unlimitedPurchaseApproval: false,
        purchaseAmountApprovalLimit: "1.00",
      });
      try {
        expect(await handedFor("MANAGEMENT", spr.recordNo)).toMatchObject({
          handedOver: { canAct: true },
        });
      } finally {
        await setups.save(own);
      }
    });

    it("brings a passed-on SPR back to the approver when nobody above can act", async () => {
      const spr = await waiting("9000.00");
      const management = await idOf("MANAGEMENT");
      const setups = t.app.get(ApprovalSetupRepository);
      const own = await setups.find(management);
      if (!own) throw new Error("Management has no setup");
      await decide("APPROVER", spr.recordNo, "approve");
      expect(await approverInbox()).not.toContain(spr.recordNo);

      await setups.save({ ...own, ...away });
      try {
        expect(await approverInbox()).toContain(spr.recordNo);
        expect(await handedFor("MANAGEMENT", spr.recordNo)).toBeUndefined();
      } finally {
        await setups.save(own);
      }
    });

    it("leaves an SPR in sight when the person named cannot see tasks at all", async () => {
      const spr = await waiting("100.00");
      const admin = await idOf("SYSTEM_ADMIN");
      const setups = t.app.get(ApprovalSetupRepository);
      const row = {
        userId: admin,
        approverId: null,
        salesAmountApprovalLimit: "0.00",
        purchaseAmountApprovalLimit: "0.00",
        unlimitedSalesApproval: false,
        unlimitedPurchaseApproval: false,
        substituteUserId: null,
        awayFrom: null,
        awayUntil: null,
      };
      await setups.save(row);
      try {
        await withApprover({ substituteUserId: admin, ...away }, async () => {
          expect(await approverInbox()).toContain(spr.recordNo);
        });
      } finally {
        await database.client.approvalUserSetup.delete({
          where: { userId: admin },
        });
      }
    });

    it("hands an SPR to a named approver in another role, whose inbox would never show it", async () => {
      const raisedBy = await idOf("APPROVER");
      const spr = await pendingSpr("100.00", { requesterUserId: raisedBy });

      expect(await approverInbox()).not.toContain(spr.recordNo);
      expect(await handedFor("MANAGEMENT", spr.recordNo)).toMatchObject({
        handedOver: { reason: "named", fromName: "Janet Lim" },
      });
    });

    it("keeps a passed-on SPR away from the approver while its order is on hold", async () => {
      const spr = await waiting("9000.00");
      await decide("APPROVER", spr.recordNo, "approve");
      await database.client.workflowInstance.updateMany({
        where: { orderRef: spr.orderNo },
        data: { status: "OnHold" },
      });

      expect(await approverInbox()).not.toContain(spr.recordNo);
    });

    it("does not bring back a decided SPR when the approver goes away", async () => {
      const spr = await waiting("100.00");
      await decide("APPROVER", spr.recordNo, "approve");

      await withApprover(
        { substituteUserId: await idOf("MANAGEMENT"), ...away },
        async () => {
          expect(await handedFor("MANAGEMENT", spr.recordNo)).toBeUndefined();
        },
      );
    });

    it("does not hand over an SPR that has a decision, even if its order still reads as waiting", async () => {
      const spr = await pendingSpr("100.00", {
        decision: {
          outcome: "approved",
          by: "Janet Lim",
          comment: "Recorded",
          at: new Date().toISOString(),
        },
      });

      await withApprover(
        { substituteUserId: await idOf("MANAGEMENT"), ...away },
        async () => {
          expect(await handedFor("MANAGEMENT", spr.recordNo)).toBeUndefined();
        },
      );
    });

    it("stops reminding the approver about an SPR that has left them, until it comes back", async () => {
      const reminded = async () => {
        const res = await call(
          t,
          as("APPROVER"),
          "get",
          `${W}/reminders?pageSize=100`,
        );
        return (res.body as { data: { orderNo: string }[] }).data.map(
          (reminder) => reminder.orderNo,
        );
      };
      let spr = await waiting("100.00");
      for (let tried = 1; !(await reminded()).includes(spr.orderNo); tried++) {
        if (tried > PENDING.length) {
          throw new Error("No pending SPR has a reminder to the approver");
        }
        spr = await waiting("100.00");
      }

      await withApprover(
        { substituteUserId: await idOf("MANAGEMENT"), ...away },
        async () => {
          expect(await reminded()).not.toContain(spr.orderNo);
        },
      );

      expect(await reminded()).toContain(spr.orderNo);
    });

    it("never hands an SPR to the person who raised it, and leaves it visible instead", async () => {
      const spr = await waiting("100.00");

      await withApprover(
        {
          substituteUserId: await idOf("PRODUCT_MANAGER"),
          approverId: null,
          ...away,
        },
        async () => {
          expect(
            await handedFor("PRODUCT_MANAGER", spr.recordNo),
          ).toBeUndefined();
          expect(await approverInbox()).toContain(spr.recordNo);
        },
      );
    });

    it("leaves an SPR in the approver's inbox when nobody on the chain can act", async () => {
      const spr = await waiting("100.00");

      await withApprover(
        { substituteUserId: null, approverId: null, ...away },
        async () => {
          expect(await approverInbox()).toContain(spr.recordNo);
          expect(await handedFor("MANAGEMENT", spr.recordNo)).toBeUndefined();
        },
      );
    });

    it("hands over nothing for an order no longer waiting for a decision", async () => {
      const spr = await waiting("100.00");
      await database.client.workflowInstance.updateMany({
        where: { orderRef: spr.orderNo },
        data: { status: "OnHold" },
      });

      await withApprover(
        { substituteUserId: await idOf("MANAGEMENT"), ...away },
        async () => {
          expect(await handedFor("MANAGEMENT", spr.recordNo)).toBeUndefined();
        },
      );
    });

    it("shows nobody else's handed tasks, and pages the list", async () => {
      const first = await waiting("9000.00");
      const second = await waiting("9000.00");
      await decide("APPROVER", first.recordNo, "approve");
      await decide("APPROVER", second.recordNo, "approve");

      expect(await handedFor("SUPPORT", first.recordNo)).toBeUndefined();
      expect(await handedFor("MANAGEMENT", first.recordNo)).toBeDefined();
      expect(await handedFor("MANAGEMENT", second.recordNo)).toBeDefined();
      const page = await handedTo("MANAGEMENT", "page=1&pageSize=1");
      expect(page.data).toHaveLength(1);
      expect(page.meta.total).toBeGreaterThanOrEqual(2);
      expect(page.meta.mock).toBe(true);
    });

    it("needs a signed-in caller", async () => {
      expect(
        (await call(t, null, "get", `${W}/tasks/handed-to-me`)).status,
      ).toBe(401);
    });
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

    it("passes an SPR on once when the same key arrives twice at the same moment", async () => {
      const spr = await pendingSpr("9000.00");
      const key = freshKey();
      const audits = await audited("workflows.spr.passed-on", spr.recordNo);
      const refused = await refusals();

      const [a, b] = await Promise.all([
        sendWith(key, "APPROVER", spr.recordNo, "approve"),
        sendWith(key, "APPROVER", spr.recordNo, "approve"),
      ]);

      expect([a.status, b.status]).toEqual([200, 200]);
      expect(b.body).toEqual(a.body);
      expect(
        (await audited("workflows.spr.passed-on", spr.recordNo)) - audits,
      ).toBe(1);
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
      const spr = await pendingSpr("9000.00");
      const key = freshKey();
      const passed = await sendWith(key, "APPROVER", spr.recordNo, "approve");
      expect(sprDecisionResponseSchema.parse(passed.body).data.message).toBe(
        SPR_PASSED_ON_MESSAGE,
      );

      const res = await sendWith(key, "MANAGEMENT", spr.recordNo, "approve");

      expect(res.status).toBe(200);
      expect(sprDecisionResponseSchema.parse(res.body).data.message).toBe(
        SPR_DECISION_RECORDED_MESSAGE,
      );
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

    it("passes an SPR on once above the limit, however often it is sent", async () => {
      const spr = await pendingSpr("9000.00");
      const key = freshKey();
      const audits = await audited("workflows.spr.passed-on", spr.recordNo);

      const first = await sendWith(key, "APPROVER", spr.recordNo, "approve");
      const second = await sendWith(key, "APPROVER", spr.recordNo, "approve");

      expect(first.status).toBe(200);
      expect(second.status).toBe(200);
      expect(sprDecisionResponseSchema.parse(second.body).data.message).toBe(
        SPR_PASSED_ON_MESSAGE,
      );
      expect(second.body).toEqual(first.body);
      expect(
        (await audited("workflows.spr.passed-on", spr.recordNo)) - audits,
      ).toBe(1);
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
