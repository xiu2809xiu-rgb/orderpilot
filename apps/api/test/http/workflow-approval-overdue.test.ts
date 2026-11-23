import { syntheticDataset } from "@orderpilot/synthetic-data";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { demoEmail } from "../../src/auth/demo-accounts.js";
import { Database } from "../../src/database/database.js";
import {
  ApprovalOverdueNotifier,
  type OverdueApproval,
} from "../../src/modules/workflows/domain/approval-overdue-notifier.js";
import { TaskSweepService } from "../../src/modules/workflows/task-sweep.service.js";
import { UserRepository } from "../../src/users/user.repository.js";
import { resetTestData } from "../support/reset.js";
import { createTestApp, type TestApp } from "../support/test-app.js";

const HOUR = 3_600_000;
const SPRS = syntheticDataset().sprs.filter((s) => s.status === "submitted");

/** Keeps what the sweep hands the port, and can fail on purpose for one task, as a mail server might. */
class FakeNotifier extends ApprovalOverdueNotifier {
  readonly sent: OverdueApproval[] = [];
  failOnceFor: string | null = null;

  notify(approval: OverdueApproval): Promise<void> {
    if (this.failOnceFor === approval.taskId) {
      this.failOnceFor = null;
      return Promise.reject(new Error("The mail server is down"));
    }
    this.sent.push(approval);
    return Promise.resolve();
  }
}

describe("Spectra's 24-hour rule: the approver group is emailed through a port (#251, point 3)", () => {
  let t: TestApp;
  let database: Database;
  const fake = new FakeNotifier();
  let running: typeof SPRS = [];
  let next = 0;

  const idOf = async (email: string) => {
    const user = await t.app.get(UserRepository).findByEmail(email);
    if (!user) throw new Error(`No user ${email}`);
    return user.id;
  };
  const sweep = (now: Date) => t.app.get(TaskSweepService).sweep(now);
  const escalations = (taskId: string) =>
    database.client.workflowNotification.count({
      where: { taskId, kind: "ESCALATION" },
    });

  /** An SPR approval on an order the machine runs, created now, with no notices yet. */
  async function openApproval() {
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
          requesterUserId: await idOf(demoEmail("PRODUCT_MANAGER")),
          decision: null,
          passedOn: null,
        },
      },
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
  const sentFor = (taskId: string) =>
    fake.sent.filter((approval) => approval.taskId === taskId);

  beforeAll(async () => {
    await resetTestData();
    t = await createTestApp({ APPROVER_GROUP: "on" }, [], (builder) =>
      builder.overrideProvider(ApprovalOverdueNotifier).useValue(fake),
    );
    database = t.app.get(Database);
    const rows = await database.client.workflowInstance.findMany({
      where: { status: "AwaitingSpr" },
      select: { orderRef: true },
    });
    const orders = new Set(rows.map((row) => row.orderRef));
    running = SPRS.filter((spr) => orders.has(spr.orderNo));
  });
  // A sweep handles every open approval, the seeded ones the later tests reuse
  // included, so each test starts from an empty record of calls.
  beforeEach(() => {
    fake.failOnceFor = null;
    fake.sent.length = 0;
  });
  afterAll(async () => {
    await t.close();
  });

  it("calls nothing before the 24 hours have passed", async () => {
    const task = await openApproval();
    await sweep(task.at(23.9));
    expect(sentFor(task.taskId)).toEqual([]);
  });

  it("hands the port the SPR and everyone who may decide it, by id and name only, once 24 hours pass", async () => {
    const task = await openApproval();

    await sweep(task.at(24.1));

    const [approval, ...more] = sentFor(task.taskId);
    expect(more).toEqual([]);
    expect(approval).toMatchObject({
      key: `task:${task.taskId}:escalation`,
      orderRef: task.spr.orderNo,
      recordNo: task.spr.recordNo,
    });
    const approverId = await idOf(demoEmail("APPROVER"));
    expect(approval?.approvers).toContainEqual(
      expect.objectContaining({ userId: approverId }),
    );
    // The requester never decides their own SPR, so is not asked to.
    expect(approval?.approvers.map((a) => a.userId)).not.toContain(
      await idOf(demoEmail("PRODUCT_MANAGER")),
    );
    // Nothing that could leak through a mailbox: no amount, no contact.
    expect(Object.keys(approval ?? {}).sort()).toEqual(
      ["approvers", "dueAt", "key", "orderRef", "recordNo", "taskId"].sort(),
    );
    expect(Object.keys(approval?.approvers[0] ?? {}).sort()).toEqual([
      "displayName",
      "userId",
    ]);
  });

  it("calls it once, however many times the sweep runs", async () => {
    const task = await openApproval();
    await sweep(task.at(24.1));
    await sweep(task.at(25));
    await sweep(task.at(48));
    expect(sentFor(task.taskId)).toHaveLength(1);
  });

  it("keeps nothing when the port fails, and the next sweep tries again with the same key", async () => {
    const task = await openApproval();
    fake.failOnceFor = task.taskId;

    await expect(sweep(task.at(24.1))).rejects.toThrow();
    expect(sentFor(task.taskId)).toEqual([]);
    expect(await escalations(task.taskId)).toBe(0);

    await sweep(task.at(24.2));
    expect(sentFor(task.taskId)).toHaveLength(1);
    expect(sentFor(task.taskId)[0]?.key).toBe(`task:${task.taskId}:escalation`);
    expect(await escalations(task.taskId)).toBe(1);
  });

  it("emails nobody about an SPR that was decided before the 24 hours passed", async () => {
    const task = await openApproval();
    await database.client.workflowTask.update({
      where: { id: task.taskId },
      data: { status: "DONE", completedAt: new Date() },
    });
    await sweep(task.at(24.1));
    expect(sentFor(task.taskId)).toEqual([]);
  });
});
