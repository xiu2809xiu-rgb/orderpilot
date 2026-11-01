import { syntheticDataset } from "@orderpilot/synthetic-data";
import {
  DEFAULT_ROLE_PERMISSIONS,
  MOCK_RECORDED_MESSAGE,
  ROLES,
  type InboxRole,
  type Role,
} from "@orderpilot/shared";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  API,
  auditCount,
  call,
  demoSignIn,
  type Browser,
} from "../support/auth.js";
import { resetTestData } from "../support/reset.js";
import { createTestApp, type TestApp } from "../support/test-app.js";
import {
  openRulesResponseSchema,
  orderFlowResponseSchema,
  paymentResponseSchema,
  paymentUndoResponseSchema,
  reminderListResponseSchema,
  sprResponseSchema,
  taskActionResponseSchema,
  taskListResponseSchema,
} from "../../src/modules/workflows/workflows.schemas.js";

const W = `${API}/workflows`;
const data = syntheticDataset();
const task = (kind: string, role: InboxRole) => {
  const found = data.tasks.find(
    (t) => t.kind === kind && t.assigneeRole === role,
  );
  if (!found) throw new Error(`No ${kind} task in the dataset`);
  return found;
};
const PACK = task("PACK_ORDER", "WAREHOUSE");
const APPROVE = task("APPROVE_SPR", "APPROVER");
const PAY = task("CONFIRM_PAYMENT", "FINANCE");
const REVIEW = task("REVIEW_FIELDS", "SUPPORT");
const REMINDED = data.tasks.find(
  (t) =>
    t.kind === "PACK_ORDER" &&
    data.reminders.some(
      (r) => r.orderNo === t.orderNo && r.toRole === "WAREHOUSE",
    ),
);
const UNKNOWN = "99999999-9999-4999-8999-999999999999";

describe("acting on the mock tasks", () => {
  let t: TestApp;
  const sessions = new Map<Role, Browser>();
  beforeAll(async () => {
    await resetTestData();
    t = await createTestApp();
    for (const role of ROLES) sessions.set(role, await demoSignIn(t, role));
  });
  afterAll(async () => {
    await t.close();
  });
  const as = (role: Role): Browser => {
    const browser = sessions.get(role);
    if (!browser) throw new Error(`no session for ${role}`);
    return browser;
  };
  const post = (role: Role, path: string, body?: object) =>
    call(t, as(role), "post", `${W}${path}`, { csrf: true, body });
  const total = async (role: Role, query = "") => {
    const res = await call(t, as(role), "get", `${W}/tasks?pageSize=1${query}`);
    return taskListResponseSchema.parse(res.body).meta.total;
  };

  it("gives tasks.complete to the six inbox roles only", () => {
    const holders = ROLES.filter((role) =>
      DEFAULT_ROLE_PERMISSIONS[role].includes("tasks.complete"),
    );
    expect(holders.sort()).toEqual(
      [
        "APPROVER",
        "FINANCE",
        "LOGISTICS",
        "PRODUCT_MANAGER",
        "SUPPORT",
        "WAREHOUSE",
      ].sort(),
    );
  });

  describe("completing a task", () => {
    it("takes the task and its reminder out of the inbox, and Undo restores both", async () => {
      if (!REMINDED) throw new Error("No reminded packing task in the dataset");
      const before = await total("WAREHOUSE");
      const remindersOf = async () => {
        const res = await call(
          t,
          as("WAREHOUSE"),
          "get",
          `${W}/reminders?pageSize=200`,
        );
        return reminderListResponseSchema
          .parse(res.body)
          .data.filter((r) => r.orderNo === REMINDED.orderNo);
      };
      expect(await remindersOf()).not.toHaveLength(0);
      const audited = await auditCount(t, "workflows.task.completed");

      const done = await post("WAREHOUSE", `/tasks/${REMINDED.id}/complete`);
      expect(done.status).toBe(200);
      const body = taskActionResponseSchema.parse(done.body);
      expect(body.meta.mock).toBe(true);
      expect(body.data).toMatchObject({
        applied: true,
        status: "DONE",
        message: MOCK_RECORDED_MESSAGE,
      });
      expect(await total("WAREHOUSE")).toBe(before - 1);
      expect(await remindersOf()).toHaveLength(0);
      expect(await auditCount(t, "workflows.task.completed")).toBe(audited + 1);

      const undoneAudit = await auditCount(t, "workflows.task.reopened");
      const undone = await post("WAREHOUSE", `/tasks/${REMINDED.id}/undo`);
      expect(undone.status).toBe(200);
      expect(taskActionResponseSchema.parse(undone.body).data.status).toBe(
        "OPEN",
      );
      expect(await total("WAREHOUSE")).toBe(before);
      expect(await remindersOf()).not.toHaveLength(0);
      expect(await auditCount(t, "workflows.task.reopened")).toBe(
        undoneAudit + 1,
      );
    });

    it("never changes the order's status", async () => {
      const status = async () => {
        const res = await call(
          t,
          as("WAREHOUSE"),
          "get",
          `${API}/tracker/orders/${PACK.orderNo ?? ""}`,
        );
        return (res.body as { data: { status: unknown } }).data.status;
      };
      const before = await status();
      await post("WAREHOUSE", `/tasks/${PACK.id}/complete`);
      expect(await status()).toEqual(before);
      await post("WAREHOUSE", `/tasks/${PACK.id}/undo`);
    });

    it("answers 401 with no session", async () => {
      const res = await call(t, null, "post", `${W}/tasks/${PACK.id}/complete`);
      expect(res.status).toBe(401);
      const undo = await call(t, null, "post", `${W}/tasks/${PACK.id}/undo`);
      expect(undo.status).toBe(401);
    });

    it("answers 401 on the SPR and payment Undo and the open rules with no session", async () => {
      const paths = [
        ["post", `/sprs/${APPROVE.ref?.recordNo ?? ""}/undo`],
        ["post", `/orders/${PAY.orderNo ?? ""}/payments/${UNKNOWN}/undo`],
        ["get", "/open-rules"],
      ] as const;
      for (const [method, path] of paths) {
        const res = await call(t, null, method, `${W}${path}`);
        expect(res.status, path).toBe(401);
      }
    });

    it("refuses a role without the permission, and audits it", async () => {
      const before = await auditCount(t, "auth.permission.refused");
      for (const role of ["SYSTEM_ADMIN", "MANAGEMENT", "AUDITOR"] as const) {
        const res = await post(role, `/tasks/${PACK.id}/complete`);
        expect(res.status, role).toBe(403);
      }
      expect(await auditCount(t, "auth.permission.refused")).toBe(before + 3);
    });

    it("refuses a task in another role's inbox, and audits it", async () => {
      const before = await auditCount(t, "workflows.task.refused");
      const res = await post("SUPPORT", `/tasks/${PACK.id}/complete`);
      expect(res.status).toBe(403);
      const undo = await post("SUPPORT", `/tasks/${PACK.id}/undo`);
      expect(undo.status).toBe(403);
      expect(await auditCount(t, "workflows.task.refused")).toBe(before + 2);
    });

    it("answers 404 for an unknown task, a closed one, and an Undo with nothing to undo", async () => {
      const unknown = await post("WAREHOUSE", `/tasks/${UNKNOWN}/complete`);
      expect(unknown.status).toBe(404);
      expect((await post("WAREHOUSE", `/tasks/${PACK.id}/undo`)).status).toBe(
        404,
      );
      await post("WAREHOUSE", `/tasks/${PACK.id}/complete`);
      const again = await post("WAREHOUSE", `/tasks/${PACK.id}/complete`);
      expect(again.status).toBe(404);
      await post("WAREHOUSE", `/tasks/${PACK.id}/undo`);
    });

    it("answers 400 for a task id that is not a UUID", async () => {
      const res = await post("WAREHOUSE", "/tasks/not-a-uuid/complete");
      expect(res.status).toBe(400);
    });

    it("will not stand in for a decision, a payment or a field review", async () => {
      const cases = [
        ["APPROVER", APPROVE.id],
        ["FINANCE", PAY.id],
        ["SUPPORT", REVIEW.id],
      ] as const;
      for (const [role, id] of cases) {
        const res = await post(role, `/tasks/${id}/complete`);
        expect(res.status, role).toBe(409);
        const undo = await post(role, `/tasks/${id}/undo`);
        expect(undo.status, role).toBe(409);
      }
    });

    it("keeps a decision and its closed task together: the task Undo cannot split them", async () => {
      const record = APPROVE.ref?.recordNo ?? "";
      const opened = await auditCount(t, "workflows.task.reopened");
      const before = await total("APPROVER", "&kind=APPROVE_SPR");
      await post("APPROVER", `/sprs/${record}/approve`, { comment: "Fine." });

      const undo = await post("APPROVER", `/tasks/${APPROVE.id}/undo`);
      expect(undo.status).toBe(409);
      expect(await total("APPROVER", "&kind=APPROVE_SPR")).toBe(before - 1);
      expect(await auditCount(t, "workflows.task.reopened")).toBe(opened);
      await post("APPROVER", `/sprs/${record}/undo`);
    });

    it("keeps a payment and its closed task together: the task Undo cannot split them", async () => {
      const orderNo = PAY.orderNo ?? "";
      const paid = await post("FINANCE", `/orders/${orderNo}/payments`, {
        paymentType: "prepayment",
        amount: PAY.amount,
        currencyCode: "USD",
        reference: "HOME-UNDO",
        paidOn: data.asOf,
      });
      const { paymentId } = paymentResponseSchema.parse(paid.body).data;
      const before = await total("FINANCE");

      const undo = await post("FINANCE", `/tasks/${PAY.id}/undo`);
      expect(undo.status).toBe(409);
      expect(await total("FINANCE")).toBe(before);
      await post("FINANCE", `/orders/${orderNo}/payments/${paymentId}/undo`);
    });

    it("records two quick completions once", async () => {
      const audited = await auditCount(t, "workflows.task.completed");
      const answers = await Promise.all([
        post("WAREHOUSE", `/tasks/${PACK.id}/complete`),
        post("WAREHOUSE", `/tasks/${PACK.id}/complete`),
      ]);
      // 409 while the first is being recorded, 404 once the task has left.
      const statuses = answers.map((res) => res.status).sort();
      expect(statuses[0]).toBe(200);
      expect([404, 409]).toContain(statuses[1]);
      expect(await auditCount(t, "workflows.task.completed")).toBe(audited + 1);
      await post("WAREHOUSE", `/tasks/${PACK.id}/undo`);
    });
  });

  describe("deciding an SPR", () => {
    const record = APPROVE.ref?.recordNo ?? "";
    const comment = "Approved from the home page.";

    it("shows the decision on the SPR, closes the task, and Undo restores it", async () => {
      const before = await total("APPROVER", "&kind=APPROVE_SPR");
      const audited = await auditCount(t, "workflows.spr.approved");
      const res = await post("APPROVER", `/sprs/${record}/approve`, {
        comment,
      });
      expect(res.status).toBe(200);
      expect(await total("APPROVER", "&kind=APPROVE_SPR")).toBe(before - 1);
      expect(await auditCount(t, "workflows.spr.approved")).toBe(audited + 1);

      const shown = await call(t, as("APPROVER"), "get", `${W}/sprs/${record}`);
      const decision = sprResponseSchema.parse(shown.body).data.decision;
      expect(decision).toMatchObject({ outcome: "approved", comment });
      expect(decision?.by).toBeTruthy();
      expect(decision?.at).toBeTruthy();

      const undoAudit = await auditCount(t, "workflows.spr.decision-undone");
      const undo = await post("APPROVER", `/sprs/${record}/undo`);
      expect(undo.status).toBe(200);
      expect(await total("APPROVER", "&kind=APPROVE_SPR")).toBe(before);
      expect(await auditCount(t, "workflows.spr.decision-undone")).toBe(
        undoAudit + 1,
      );
      const after = await call(t, as("APPROVER"), "get", `${W}/sprs/${record}`);
      expect(sprResponseSchema.parse(after.body).data.decision).toBeNull();
    });

    it("records two quick approvals once, and refuses a second decision until the first is undone", async () => {
      const audited = await auditCount(t, "workflows.spr.approved");
      const path = `/sprs/${record}/approve`;
      const answers = await Promise.all([
        post("APPROVER", path, { comment }),
        post("APPROVER", path, { comment }),
      ]);
      expect(answers.map((res) => res.status).sort()).toEqual([200, 409]);
      const later = await post("APPROVER", `/sprs/${record}/reject`, {
        comment,
      });
      expect(later.status).toBe(409);
      expect(await auditCount(t, "workflows.spr.approved")).toBe(audited + 1);
      await post("APPROVER", `/sprs/${record}/undo`);
    });

    it("refuses an Undo by a role that cannot decide, and one with nothing to undo", async () => {
      await post("APPROVER", `/sprs/${record}/approve`, { comment });
      expect((await post("SUPPORT", `/sprs/${record}/undo`)).status).toBe(403);
      await post("APPROVER", `/sprs/${record}/undo`);
      expect((await post("APPROVER", `/sprs/${record}/undo`)).status).toBe(404);
      const bad = await post("APPROVER", "/sprs/not-a-number/undo");
      expect(bad.status).toBe(400);
    });
  });

  describe("confirming a payment", () => {
    const orderNo = PAY.orderNo ?? "";
    const body = {
      paymentType: "prepayment",
      amount: PAY.amount,
      currencyCode: "USD",
      reference: "HOME-0001",
      paidOn: data.asOf,
    };

    it("closes the task, shows the confirmation on the order, and Undo restores it", async () => {
      const before = await total("FINANCE");
      const flow = async () => {
        const res = await call(
          t,
          as("FINANCE"),
          "get",
          `${W}/orders/${orderNo}/flow`,
        );
        return orderFlowResponseSchema.parse(res.body).data.payment;
      };
      const confirmed = (await flow()).confirmations.length;
      const confirmedAudit = await auditCount(t, "workflows.payment.confirmed");
      const res = await post("FINANCE", `/orders/${orderNo}/payments`, body);
      expect(res.status).toBe(200);
      const answer = paymentResponseSchema.parse(res.body);
      expect(answer.data.applied).toBe(true);
      expect(await total("FINANCE")).toBe(before - 1);
      expect((await flow()).confirmations).toHaveLength(confirmed + 1);
      expect(await auditCount(t, "workflows.payment.confirmed")).toBe(
        confirmedAudit + 1,
      );

      const audited = await auditCount(t, "workflows.payment.undone");
      const undo = await post(
        "FINANCE",
        `/orders/${orderNo}/payments/${answer.data.paymentId}/undo`,
      );
      expect(undo.status).toBe(200);
      expect(paymentUndoResponseSchema.parse(undo.body).meta.mock).toBe(true);
      expect(await total("FINANCE")).toBe(before);
      expect((await flow()).confirmations).toHaveLength(confirmed);
      expect(await auditCount(t, "workflows.payment.undone")).toBe(audited + 1);
    });

    it("records two quick confirmations once, so one Undo gives the order back", async () => {
      const path = `/orders/${orderNo}/payments`;
      const audited = await auditCount(t, "workflows.payment.confirmed");
      const answers = await Promise.all([
        post("FINANCE", path, body),
        post("FINANCE", path, body),
      ]);
      expect(answers.map((res) => res.status).sort()).toEqual([200, 409]);
      expect(await auditCount(t, "workflows.payment.confirmed")).toBe(
        audited + 1,
      );
      const after = await post("FINANCE", path, {
        ...body,
        reference: "HOME-0002",
      });
      expect(after.status).toBe(409);

      const first = answers.find((res) => res.status === 200);
      const { paymentId } = paymentResponseSchema.parse(first?.body).data;
      await post("FINANCE", `${path}/${paymentId}/undo`);
      const res = await call(
        t,
        as("FINANCE"),
        "get",
        `${W}/orders/${orderNo}/flow`,
      );
      const { confirmations } = orderFlowResponseSchema.parse(res.body).data
        .payment;
      expect(confirmations.some((c) => c.reference.startsWith("HOME-"))).toBe(
        false,
      );
    });

    it("refuses an Undo by another role, of an unknown payment, or with a bad id", async () => {
      const path = `/orders/${orderNo}/payments`;
      expect((await post("SUPPORT", `${path}/${UNKNOWN}/undo`)).status).toBe(
        403,
      );
      expect((await post("FINANCE", `${path}/${UNKNOWN}/undo`)).status).toBe(
        404,
      );
      expect((await post("FINANCE", `${path}/nope/undo`)).status).toBe(400);
    });
  });

  describe("the rules waiting for Spectra", () => {
    it("lists the four open rules for the system admin", async () => {
      const res = await call(t, as("SYSTEM_ADMIN"), "get", `${W}/open-rules`);
      expect(res.status).toBe(200);
      const rules = openRulesResponseSchema.parse(res.body);
      expect(rules.meta.mock).toBe(true);
      expect(rules.data.map((rule) => rule.id)).toEqual([
        "sprTrigger",
        "piSequence",
        "approversAndLimits",
        "delegation",
      ]);
    });

    it("is refused to a role that does not configure the platform", async () => {
      const res = await call(t, as("SUPPORT"), "get", `${W}/open-rules`);
      expect(res.status).toBe(403);
    });

    it("links a rule only to a screen that shows it", async () => {
      const res = await call(t, as("SYSTEM_ADMIN"), "get", `${W}/open-rules`);
      const rules = openRulesResponseSchema.parse(res.body);
      expect(rules.data.map((rule) => rule.screen)).toEqual([
        null,
        null,
        null,
        null,
      ]);
    });
  });
});
