import { ROLES, TASK_KINDS, type Role } from "@orderpilot/shared";
import { syntheticDataset } from "@orderpilot/synthetic-data";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { AuditService } from "../../src/audit/audit.service.js";
import { demoEmail } from "../../src/auth/demo-accounts.js";
import { Database } from "../../src/database/database.js";
import { ApprovalSetupRepository } from "../../src/modules/governance/approval-setup.repository.js";
import { TaskSweepService } from "../../src/modules/workflows/task-sweep.service.js";
import { WorkflowTaskRepository } from "../../src/modules/workflows/workflow-task.repository.js";
import {
  SWEEP_QUEUE,
  SWEEP_SCHEDULER,
  WorkflowSweepJob,
} from "../../src/modules/workflows/workflow-sweep.job.js";
import { noticeListResponseSchema } from "../../src/modules/workflows/workflows.schemas.js";
import { QueueService } from "../../src/queue/queue.service.js";
import { Prisma } from "../../src/generated/prisma/client.js";
import { UserRepository } from "../../src/users/user.repository.js";
import { API, call, demoSignIn, type Browser } from "../support/auth.js";
import { resetTestData } from "../support/reset.js";
import { createTestApp, type TestApp } from "../support/test-app.js";

const W = `${API}/workflows`;
const HOUR = 3_600_000;
const SPRS = syntheticDataset().sprs.filter((s) => s.status === "submitted");

describe("reminders and escalations (C-4), with the seeded settings: due in 24 h, reminded 4 h before, and at 24 h the management team is told, as Spectra asked", () => {
  let t: TestApp;
  let database: Database;
  const sessions = new Map<Role, Browser>();
  let running: typeof SPRS = [];
  let next = 0;

  const as = (role: Role): Browser => {
    const session = sessions.get(role);
    if (!session) throw new Error(`No session for ${role}`);
    return session;
  };
  const idOf = async (role: Role) => {
    const user = await t.app.get(UserRepository).findByEmail(demoEmail(role));
    if (!user) throw new Error(`No demo user for ${role}`);
    return user.id;
  };

  /** A task on an order the machine runs, created now, with no notices yet. */
  async function openTask() {
    const spr = running[next % running.length];
    next += 1;
    if (!spr) throw new Error("No SPR on an order the machine runs");
    const record = await database.client.workflowRecord.findFirstOrThrow({
      where: { recordType: "SPR", instance: { orderRef: spr.orderNo } },
    });
    await database.client.workflowRecord.update({
      where: { id: record.id },
      data: {
        data: {
          ...(record.data as object),
          amount: "100.00",
          requesterUserId: await idOf("PRODUCT_MANAGER"),
          decision: null,
          passedOn: null,
        },
      },
    });
    await database.client.workflowInstance.updateMany({
      where: { orderRef: spr.orderNo },
      data: { status: "AwaitingSpr" },
    });
    const task = await database.client.workflowTask.findFirstOrThrow({
      where: { kind: "APPROVE_SPR", instance: { orderRef: spr.orderNo } },
    });
    const start = new Date();
    await database.client.workflowTask.update({
      where: { id: task.id },
      data: { status: "OPEN", completedAt: null, createdAt: start },
    });
    await database.client.workflowNotification.deleteMany({
      where: { taskId: task.id },
    });
    await database.client.workflowEvent.deleteMany({
      where: { idempotencyKey: { startsWith: `task:${task.id}:` } },
    });
    return {
      spr,
      taskId: task.id,
      at: (hours: number) => new Date(start.getTime() + hours * HOUR),
    };
  }

  const sweep = (now: Date) => t.app.get(TaskSweepService).sweep(now);
  const noticesOf = (taskId: string) =>
    database.client.workflowNotification.findMany({
      where: { taskId },
      orderBy: { createdAt: "asc" },
    });
  const noticesFor = async (role: Role) => {
    const res = await call(
      t,
      as(role),
      "get",
      `${W}/reminders/for-me?pageSize=200`,
    );
    expect(res.status).toBe(200);
    return noticeListResponseSchema.parse(res.body);
  };

  beforeAll(async () => {
    await resetTestData();
    t = await createTestApp();
    database = t.app.get(Database);
    for (const role of ROLES) sessions.set(role, await demoSignIn(t, role));
    const rows = await database.client.workflowInstance.findMany({
      where: { status: "AwaitingSpr" },
      select: { orderRef: true },
    });
    const orders = new Set(rows.map((row) => row.orderRef));
    running = SPRS.filter((spr) => orders.has(spr.orderNo));
  });

  afterAll(async () => {
    await t.close();
  });

  describe("the sweep", () => {
    it("sends nothing before the reminder time", async () => {
      const task = await openTask();

      await sweep(task.at(19.9));

      expect(await noticesOf(task.taskId)).toEqual([]);
    });

    it("reminds the task's owner before it is due", async () => {
      const task = await openTask();

      await sweep(task.at(20));

      const [notice, ...rest] = await noticesOf(task.taskId);
      expect(rest).toEqual([]);
      expect(notice).toMatchObject({
        kind: "REMINDER",
        recipientRole: "APPROVER",
        recipientUserId: null,
        orderRef: task.spr.orderNo,
      });
      expect(notice?.sentAt).not.toBeNull();
      const mine = await noticesFor("APPROVER");
      expect(mine.data.map((n) => n.id)).toContain(notice?.id);
    });

    it("sends the reminder once, however many times the job runs, even at once", async () => {
      const task = await openTask();

      await Promise.all([sweep(task.at(20)), sweep(task.at(20))]);
      await sweep(task.at(21));

      expect(await noticesOf(task.taskId)).toHaveLength(1);
    });

    it("does not escalate until the escalation time", async () => {
      const task = await openTask();

      await sweep(task.at(23.9));

      expect((await noticesOf(task.taskId)).map((n) => n.kind)).toEqual([
        "REMINDER",
      ]);
    });

    it("tells the management team when an approval is not actioned in 24 hours, as Spectra asked", async () => {
      const task = await openTask();

      await sweep(task.at(24));

      const escalation = (await noticesOf(task.taskId)).find(
        (n) => n.kind === "ESCALATION",
      );
      expect(escalation).toMatchObject({ recipientRole: "MANAGEMENT" });
      const mine = await noticesFor("MANAGEMENT");
      expect(mine.data.map((n) => n.id)).toContain(escalation?.id);
    });

    it("escalates once, however many times the job runs", async () => {
      const task = await openTask();

      await sweep(task.at(48));
      await sweep(task.at(72));

      expect(
        (await noticesOf(task.taskId)).filter((n) => n.kind === "ESCALATION"),
      ).toHaveLength(1);
    });

    it("sends neither to a task finished in time", async () => {
      const task = await openTask();
      const res = await call(
        t,
        as("APPROVER"),
        "post",
        `${W}/sprs/${task.spr.recordNo}/approve`,
        { csrf: true, body: { comment: "Fine" } },
      );
      expect(res.status).toBe(200);

      await sweep(task.at(48));

      expect(await noticesOf(task.taskId)).toEqual([]);
    });

    it("closes the task on a rejection too", async () => {
      const task = await openTask();
      const res = await call(
        t,
        as("APPROVER"),
        "post",
        `${W}/sprs/${task.spr.recordNo}/reject`,
        { csrf: true, body: { comment: "No" } },
      );
      expect(res.status).toBe(200);

      await sweep(task.at(48));

      expect(await noticesOf(task.taskId)).toEqual([]);
    });

    it("keeps the task open when the SPR is passed on above a limit, and reminds the next person", async () => {
      const task = await openTask();
      const record = await database.client.workflowRecord.findFirstOrThrow({
        where: { recordType: "SPR", instance: { orderRef: task.spr.orderNo } },
      });
      await database.client.workflowRecord.update({
        where: { id: record.id },
        data: { data: { ...(record.data as object), amount: "9000.00" } },
      });
      const res = await call(
        t,
        as("APPROVER"),
        "post",
        `${W}/sprs/${task.spr.recordNo}/approve`,
        { csrf: true, body: { comment: "Above me" } },
      );
      expect(res.status).toBe(200);

      await sweep(task.at(20));

      expect(await noticesOf(task.taskId)).toMatchObject([
        {
          recipientRole: "MANAGEMENT",
          recipientUserId: await idOf("MANAGEMENT"),
        },
      ]);
    });

    it("tells nobody that nobody acted while the order is on hold, when nobody can", async () => {
      const task = await openTask();
      await database.client.workflowInstance.updateMany({
        where: { orderRef: task.spr.orderNo },
        data: { status: "OnHold" },
      });

      await sweep(task.at(48));

      expect(await noticesOf(task.taskId)).toEqual([]);
    });

    it("does not send on a task a decision closed while the sweep was running", async () => {
      const task = await openTask();
      const repository = t.app.get(WorkflowTaskRepository);
      const seen = await repository.open();
      await call(
        t,
        as("APPROVER"),
        "post",
        `${W}/sprs/${task.spr.recordNo}/approve`,
        { csrf: true, body: { comment: "Fine" } },
      );
      const stale = vi.spyOn(repository, "open").mockResolvedValueOnce(seen);

      await sweep(task.at(48));
      stale.mockRestore();

      expect(await noticesOf(task.taskId)).toEqual([]);
      expect(
        await database.client.workflowEvent.count({
          where: { idempotencyKey: { startsWith: `task:${task.taskId}:` } },
        }),
      ).toBe(0);
    });

    it("holds an escalation back while the named role cannot see tasks, and sends it once it can", async () => {
      const task = await openTask();
      const grant = (granted: boolean) =>
        call(
          t,
          as("SYSTEM_ADMIN"),
          "put",
          `${API}/governance/matrix/MANAGEMENT/permissions/workflows.read`,
          { csrf: true, body: { granted } },
        );
      const escalations = async () =>
        (await noticesOf(task.taskId)).filter((n) => n.kind === "ESCALATION");
      expect((await grant(false)).status).toBe(200);

      try {
        await expect(sweep(task.at(48))).rejects.toThrow(/could not be sent/);
        expect(await escalations()).toEqual([]);
      } finally {
        expect((await grant(true)).status).toBe(200);
      }

      await sweep(task.at(48));

      expect(await escalations()).toHaveLength(1);
    });

    it("marks a task overdue at its due time, once, as settings can put the escalation later", async () => {
      const task = await openTask();
      const types = async () =>
        (
          await database.client.workflowEvent.findMany({
            where: { idempotencyKey: { startsWith: `task:${task.taskId}:` } },
          })
        ).map((e) => e.type);
      const before = await database.client.workflowTaskSla.findUniqueOrThrow({
        where: { taskKind: "APPROVE_SPR" },
      });
      await database.client.workflowTaskSla.update({
        where: { taskKind: "APPROVE_SPR" },
        data: { escalateAfterMinutes: 1_440 },
      });

      try {
        await sweep(task.at(23.9));
        expect(await types()).not.toContain("task.overdue");

        await sweep(task.at(24));
        await sweep(task.at(25));

        expect(
          (await types()).filter((e) => e === "task.overdue"),
        ).toHaveLength(1);
        expect((await noticesOf(task.taskId)).map((n) => n.kind)).toEqual([
          "REMINDER",
        ]);
      } finally {
        await database.client.workflowTaskSla.update({
          where: { taskKind: "APPROVE_SPR" },
          data: { escalateAfterMinutes: before.escalateAfterMinutes },
        });
      }
    });

    it("takes a notice off the list once its task is finished", async () => {
      const task = await openTask();
      await sweep(task.at(20));
      const [sent] = await noticesOf(task.taskId);

      const res = await call(
        t,
        as("APPROVER"),
        "post",
        `${W}/sprs/${task.spr.recordNo}/approve`,
        { csrf: true, body: { comment: "Fine" } },
      );
      expect(res.status).toBe(200);
      await sweep(task.at(48));

      expect(await noticesOf(task.taskId)).toHaveLength(1);
      expect(
        (await noticesFor("APPROVER")).data.map((n) => n.id),
      ).not.toContain(sent?.id);
    });

    it("picks the task up again when the decision is undone", async () => {
      const task = await openTask();
      const path = `${W}/sprs/${task.spr.recordNo}`;
      const body = { csrf: true, body: { comment: "Fine" } };
      await call(t, as("APPROVER"), "post", `${path}/approve`, body);
      await sweep(task.at(20));
      expect(await noticesOf(task.taskId)).toEqual([]);

      await call(t, as("APPROVER"), "post", `${path}/undo`, { csrf: true });
      await sweep(task.at(20));

      expect(await noticesOf(task.taskId)).toHaveLength(1);
    });

    it("reminds whoever holds the SPR, personally, and not the absent approver", async () => {
      const task = await openTask();
      const management = await idOf("MANAGEMENT");
      const setups = t.app.get(ApprovalSetupRepository);
      const approver = await idOf("APPROVER");
      const before = await setups.find(approver);
      if (!before) throw new Error("The approver has no setup");

      await setups.save({
        ...before,
        substituteUserId: management,
        awayFrom: task.at(-1),
        awayUntil: task.at(100),
      });
      try {
        await sweep(task.at(20));
      } finally {
        await setups.save(before);
      }

      const [notice] = await noticesOf(task.taskId);
      expect(notice).toMatchObject({
        recipientRole: "MANAGEMENT",
        recipientUserId: management,
      });
      const ids = async (role: Role) =>
        (await noticesFor(role)).data.map((n) => n.id);
      expect(await ids("MANAGEMENT")).toContain(notice?.id);
      expect(await ids("APPROVER")).not.toContain(notice?.id);
    });

    it("keeps a personal notice from everyone else in that person's role", async () => {
      const task = await openTask();
      const notice = await database.client.workflowNotification.create({
        data: {
          dedupeKey: `test:${task.taskId}`,
          kind: "REMINDER",
          taskId: task.taskId,
          instanceId: (
            await database.client.workflowTask.findUniqueOrThrow({
              where: { id: task.taskId },
            })
          ).instanceId,
          orderRef: task.spr.orderNo,
          recipientRole: "APPROVER",
          recipientUserId: await idOf("MANAGEMENT"),
          message: "For one person",
          scheduledFor: new Date(),
          sentAt: new Date(),
        },
      });

      const ids = (await noticesFor("APPROVER")).data.map((n) => n.id);

      expect(ids).not.toContain(notice.id);
    });

    it("reminds a new holder once as well, when the SPR moves on after a reminder", async () => {
      const task = await openTask();
      const management = await idOf("MANAGEMENT");
      const setups = t.app.get(ApprovalSetupRepository);
      const approver = await idOf("APPROVER");
      const before = await setups.find(approver);
      if (!before) throw new Error("The approver has no setup");
      await sweep(task.at(20));

      await setups.save({
        ...before,
        substituteUserId: management,
        awayFrom: task.at(-1),
        awayUntil: task.at(100),
      });
      try {
        await sweep(task.at(21));
        await sweep(task.at(22));
      } finally {
        await setups.save(before);
      }

      expect(
        (await noticesOf(task.taskId)).map((n) => n.recipientRole),
      ).toEqual(["APPROVER", "MANAGEMENT"]);
    });

    it("leaves alone a task on a sample order the machine does not run", async () => {
      const sample = await database.client.workflowTask.findFirstOrThrow({
        where: {
          status: "OPEN",
          instance: { facts: { equals: Prisma.DbNull } },
        },
      });

      await sweep(new Date(Date.now() + 1_000 * HOUR));

      expect(await noticesOf(sample.id)).toEqual([]);
    });

    it("records a workflow event and an audit event for each notice, for the tracker's overdue flag", async () => {
      const task = await openTask();
      // The audit trail is append only, so a reused task keeps its earlier events.
      const auditedBefore = await database.client.auditEvent.count({
        where: { entityType: "WorkflowTask", entityId: task.taskId },
      });

      await sweep(task.at(48));

      const events = await database.client.workflowEvent.findMany({
        where: { idempotencyKey: { startsWith: `task:${task.taskId}:` } },
      });
      expect(events.map((e) => e.type).sort()).toEqual([
        "task.escalated",
        "task.overdue",
        "task.reminded",
      ]);
      expect(events.every((e) => e.actorKind === "system")).toBe(true);
      const audited = await database.client.auditEvent.findMany({
        where: { entityType: "WorkflowTask", entityId: task.taskId },
        orderBy: { sequence: "asc" },
      });
      expect(
        audited
          .slice(auditedBefore)
          .map((e) => e.action)
          .sort(),
      ).toEqual([
        "workflows.task.escalated",
        "workflows.task.overdue",
        "workflows.task.reminded",
      ]);
    });

    it("writes each audit event once, however many times the job runs", async () => {
      const task = await openTask();
      const audited = () =>
        database.client.auditEvent.count({
          where: { entityType: "WorkflowTask", entityId: task.taskId },
        });
      const before = await audited();

      await sweep(task.at(48));
      await sweep(task.at(49));

      expect((await audited()) - before).toBe(3);
    });

    it("treats a closed task as finished even if its order still reads as waiting", async () => {
      const task = await openTask();
      await sweep(task.at(20));
      const [sent] = await noticesOf(task.taskId);
      await database.client.workflowTask.update({
        where: { id: task.taskId },
        data: { status: "DONE" },
      });

      await sweep(task.at(48));
      const mine = await noticesFor("APPROVER");

      expect(await noticesOf(task.taskId)).toHaveLength(1);
      expect(mine.data.map((n) => n.id)).not.toContain(sent?.id);
      expect(mine.meta.total).toBe(mine.data.length);
    });

    it("retries a failed notification without sending it twice, and still sends the others", async () => {
      const failing = await openTask();
      const other = await openTask();
      const audit = t.app.get(AuditService);
      const real = audit.record.bind(audit);
      const spy = vi
        .spyOn(audit, "record")
        .mockImplementation(async (input) => {
          if (input.entityId === failing.taskId)
            throw new Error("Audit is down");
          return real(input);
        });

      await expect(sweep(other.at(20))).rejects.toThrow(/could not be sent/);
      spy.mockRestore();

      expect(await noticesOf(failing.taskId)).toEqual([]);
      expect(await noticesOf(other.taskId)).toHaveLength(1);

      await sweep(other.at(20));

      expect(await noticesOf(failing.taskId)).toHaveLength(1);
      expect(await noticesOf(other.taskId)).toHaveLength(1);
    });
  });

  describe("the settings", () => {
    const path = `${W}/sla-settings`;
    const body = {
      dueAfterMinutes: 120,
      remindBeforeMinutes: 60,
      escalateAfterMinutes: 30,
      escalateToRole: "FINANCE",
    };

    async function withChanged(work: () => Promise<void>) {
      const before = await database.client.workflowTaskSla.findUniqueOrThrow({
        where: { taskKind: "APPROVE_SPR" },
      });
      const res = await call(
        t,
        as("SYSTEM_ADMIN"),
        "put",
        `${path}/APPROVE_SPR`,
        {
          csrf: true,
          body,
        },
      );
      expect(res.status).toBe(200);
      try {
        await work();
      } finally {
        await database.client.workflowTaskSla.update({
          where: { taskKind: "APPROVE_SPR" },
          data: {
            dueAfterMinutes: before.dueAfterMinutes,
            remindBeforeMinutes: before.remindBeforeMinutes,
            escalateAfterMinutes: before.escalateAfterMinutes,
            escalateToRole: before.escalateToRole,
          },
        });
      }
    }

    it("refuses an escalation to a role that could never see it", async () => {
      const res = await call(
        t,
        as("SYSTEM_ADMIN"),
        "put",
        `${path}/APPROVE_SPR`,
        {
          csrf: true,
          body: { ...body, escalateToRole: "SYSTEM_ADMIN" },
        },
      );

      expect(res.status).toBe(409);
    });

    it("accepts escalating the moment a task is due, and refuses a negative time", async () => {
      const put = (escalateAfterMinutes: number) =>
        call(t, as("SYSTEM_ADMIN"), "put", `${path}/APPROVE_SPR`, {
          csrf: true,
          body: { ...body, escalateAfterMinutes },
        });
      const before = await database.client.workflowTaskSla.findUniqueOrThrow({
        where: { taskKind: "APPROVE_SPR" },
      });
      try {
        expect((await put(-1)).status).toBe(400);
        expect((await put(0)).status).toBe(200);
      } finally {
        await database.client.workflowTaskSla.update({
          where: { taskKind: "APPROVE_SPR" },
          data: {
            dueAfterMinutes: before.dueAfterMinutes,
            remindBeforeMinutes: before.remindBeforeMinutes,
            escalateAfterMinutes: before.escalateAfterMinutes,
            escalateToRole: before.escalateToRole,
          },
        });
      }
    });

    it("refuses a time too long to mean anything", async () => {
      const res = await call(
        t,
        as("SYSTEM_ADMIN"),
        "put",
        `${path}/APPROVE_SPR`,
        {
          csrf: true,
          body: { ...body, escalateAfterMinutes: 3_000_000_000 },
        },
      );

      expect(res.status).toBe(400);
    });

    it("moves the stored due date of open tasks when the setting changes", async () => {
      const task = await openTask();

      await withChanged(async () => {
        const row = await database.client.workflowTask.findUniqueOrThrow({
          where: { id: task.taskId },
        });
        expect(row.dueAt).toEqual(task.at(2));
      });
    });

    it("lets those who manage settings read them, and nobody else", async () => {
      expect((await call(t, as("APPROVER"), "get", path)).status).toBe(403);
    });

    it("lists a setting for every kind of task", async () => {
      const res = await call(t, as("SYSTEM_ADMIN"), "get", path);

      expect(res.status).toBe(200);
      const { data } = res.body as { data: { taskKind: string }[] };
      expect(data.map((s) => s.taskKind)).toContain("APPROVE_SPR");
      expect(data).toHaveLength(TASK_KINDS.length);
      expect(data.map((s) => s.taskKind)).toContain("PLACE_VENDOR_PO");
    });

    it("takes the times and the person to escalate to from the settings, not from code", async () => {
      const task = await openTask();

      await withChanged(async () => {
        await sweep(task.at(0.9));
        expect(await noticesOf(task.taskId)).toEqual([]);
        await sweep(task.at(1));
        expect((await noticesOf(task.taskId)).map((n) => n.kind)).toEqual([
          "REMINDER",
        ]);
        await sweep(task.at(2.5));
      });

      const escalation = (await noticesOf(task.taskId)).find(
        (n) => n.kind === "ESCALATION",
      );
      expect(escalation).toMatchObject({ recipientRole: "FINANCE" });
    });

    it("audits a change", async () => {
      const count = () =>
        database.client.auditEvent.count({
          where: { action: "workflows.sla.changed", entityId: "APPROVE_SPR" },
        });
      const before = await count();

      await withChanged(async () => {
        expect(await count()).toBe(before + 1);
      });
    });

    it("lets only those who manage settings change them", async () => {
      const res = await call(t, as("APPROVER"), "put", `${path}/APPROVE_SPR`, {
        csrf: true,
        body,
      });

      expect(res.status).toBe(403);
    });

    it("refuses a reminder set to go before the task even starts", async () => {
      const res = await call(
        t,
        as("SYSTEM_ADMIN"),
        "put",
        `${path}/APPROVE_SPR`,
        {
          csrf: true,
          body: { ...body, remindBeforeMinutes: 121 },
        },
      );

      expect(res.status).toBe(400);
    });

    it("refuses a kind of task that does not exist", async () => {
      const res = await call(t, as("SYSTEM_ADMIN"), "put", `${path}/MAKE_TEA`, {
        csrf: true,
        body,
      });

      expect(res.status).toBe(400);
    });
  });

  describe("the job", () => {
    it("retries a failed run with the queue's back-off, without waiting for the next one", async () => {
      const task = await openTask();
      await database.client.workflowTask.update({
        where: { id: task.taskId },
        data: { createdAt: new Date(Date.now() - 100 * HOUR) },
      });
      const job = t.app.get(WorkflowSweepJob);
      const sweeps = t.app.get(TaskSweepService);
      const failOnce = vi
        .spyOn(sweeps, "sweep")
        .mockRejectedValueOnce(new Error("The first try fails"));

      // A long interval, so only a retry can run it a second time in this test.
      await job.start(3_600);
      try {
        await vi.waitFor(
          async () => {
            expect(failOnce.mock.calls.length).toBeGreaterThanOrEqual(2);
            expect(await noticesOf(task.taskId)).not.toEqual([]);
          },
          { timeout: 20_000, interval: 250 },
        );
      } finally {
        failOnce.mockRestore();
        await job.stop();
        await t.app
          .get(QueueService)
          .queue(SWEEP_QUEUE)
          .removeJobScheduler(SWEEP_SCHEDULER);
      }
    }, 30_000);

    it("runs the sweep as a real queued job", async () => {
      const task = await openTask();
      await database.client.workflowTask.update({
        where: { id: task.taskId },
        data: { createdAt: new Date(Date.now() - 100 * HOUR) },
      });
      const job = t.app.get(WorkflowSweepJob);

      await job.start(1);
      try {
        await vi.waitFor(
          async () => {
            expect(
              (await noticesOf(task.taskId)).map((n) => n.kind).sort(),
            ).toEqual(["ESCALATION", "REMINDER"]);
          },
          { timeout: 20_000, interval: 250 },
        );
      } finally {
        await job.stop();
        await t.app
          .get(QueueService)
          .queue(SWEEP_QUEUE)
          .removeJobScheduler(SWEEP_SCHEDULER);
      }
    }, 30_000);
  });

  it("needs a signed-in caller", async () => {
    expect((await call(t, null, "get", `${W}/reminders/for-me`)).status).toBe(
      401,
    );
  });
});
