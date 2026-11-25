import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { AuditEventRepository } from "../../src/audit/audit-event.repository.js";
import { AuditService } from "../../src/audit/audit.service.js";
import { demoEmail } from "../../src/auth/demo-accounts.js";
import { DomainError } from "../../src/common/domain-error.js";
import { Database } from "../../src/database/database.js";
import { seedApprovalSetups } from "../../src/modules/governance/approval-setup-seed.js";
import type {
  OrderActor,
  OrderCommand,
} from "../../src/modules/workflows/domain/order-state-machine.js";
import { OrderWorkflowRepository } from "../../src/modules/workflows/order-workflow.repository.js";
import { OrderWorkflowService } from "../../src/modules/workflows/order-workflow.service.js";
import { WorkflowCheckReporter } from "../../src/modules/workflows/workflow-check-reporter.js";
import { WorkflowOrderStatusReader } from "../../src/modules/workflows/workflow-order-status-reader.js";
import { UserRepository } from "../../src/users/user.repository.js";
import { resetTestData } from "../support/reset.js";
import { createTestContext, type TestContext } from "../support/test-app.js";
import type { Role } from "@orderpilot/shared";

const INFO = { ip: null, traceId: "trace-order-workflow" };

let clock = Date.parse("2026-11-06T02:00:00.000Z");
/** A later moment each time, so that the events have one certain order. */
function tick(): Date {
  clock += 1000;
  return new Date(clock);
}

describe("the order workflow, against the real database and area 4's real policy", () => {
  let t: TestContext;
  let workflow: OrderWorkflowService;
  let database: Database;
  let audit: AuditService;
  let actors: Record<Role, OrderActor & { kind: "user" }>;
  const SYSTEM: OrderActor = { kind: "system", name: "checks" };
  let serial = 0;

  /** A new order, so that no test depends on another's. */
  function orderRef(): string {
    serial += 1;
    return `SO-TEST-${String(serial)}`;
  }

  async function rows(ref: string) {
    return database.client.workflowInstance.findFirstOrThrow({
      where: { orderRef: ref },
      include: { events: { orderBy: { occurredAt: "asc" } } },
    });
  }

  async function auditActions(ref: string): Promise<string[]> {
    const found: string[] = [];
    for await (const event of t.app.get(AuditEventRepository).readChain()) {
      if (event.entityId === ref) found.push(event.action);
    }
    return found;
  }

  /** A started order, walked as far as the SPR waiting for a decision. */
  async function orderAwaitingSpr(ref: string): Promise<void> {
    await workflow.start(
      ref,
      { prepaymentDue: null },
      actors.SUPPORT,
      INFO,
      tick(),
    );
    const steps: readonly [OrderCommand, OrderActor][] = [
      [{ type: "FIELDS_CONFIRMED", allFieldsConfirmed: true }, actors.SUPPORT],
      [
        { type: "STOCK_CHECKED", stockCoversOrder: false },
        actors.PRODUCT_MANAGER,
      ],
      [{ type: "SPR_RAISED" }, actors.PRODUCT_MANAGER],
    ];
    for (const [command, actor] of steps) {
      await applyAny(ref, command, actor);
    }
  }

  function applyAny(ref: string, command: OrderCommand, actor: OrderActor) {
    if (
      command.type === "SPR_APPROVED" ||
      command.type === "SPR_REJECTED" ||
      command.type === "SPR_DECISION_UNDONE"
    ) {
      throw new Error("An SPR decision goes through decideSpr");
    }
    if (
      command.type === "SALES_APPROVED" ||
      command.type === "SALES_APPROVAL_UNDONE"
    ) {
      throw new Error("A sales approval goes through decideSale");
    }
    return workflow.apply(ref, command, actor, INFO, tick());
  }

  function spr(amount: string) {
    return {
      recordNo: "SPR-20261106-0001",
      amount,
      requesterUserId: actors.PRODUCT_MANAGER.userId,
    };
  }

  function codeOf(error: unknown): string {
    if (error instanceof DomainError) return error.code;
    throw error;
  }

  beforeAll(async () => {
    await resetTestData();
    t = await createTestContext();
    workflow = t.app.get(OrderWorkflowService);
    database = t.app.get(Database);
    audit = t.app.get(AuditService);
    await seedApprovalSetups(t.app);

    const users = t.app.get(UserRepository);
    const entries = await Promise.all(
      (
        [
          "SUPPORT",
          "PRODUCT_MANAGER",
          "APPROVER",
          "FINANCE",
          "WAREHOUSE",
          "LOGISTICS",
        ] as const
      ).map(async (role) => {
        const user = await users.findByEmail(demoEmail(role));
        if (!user) throw new Error(`No demo user for ${role}`);
        const actor = {
          kind: "user" as const,
          userId: user.id,
          name: `Test ${role}`,
          role,
        };
        return [role, actor] as const;
      }),
    );
    actors = Object.fromEntries(entries) as typeof actors;
  });

  afterAll(async () => {
    await t.close();
  });

  it("writes a workflow event for every transition, with who and when", async () => {
    const ref = orderRef();
    await workflow.start(
      ref,
      { prepaymentDue: "500.00" },
      actors.SUPPORT,
      INFO,
      tick(),
    );
    await applyAny(
      ref,
      { type: "FIELDS_CONFIRMED", allFieldsConfirmed: true },
      actors.SUPPORT,
    );

    const row = await rows(ref);
    expect(row).toMatchObject({
      status: "Confirmed",
      currentStep: "stock-checked",
      version: 1,
    });
    expect(row.events.map((e) => [e.type, e.fromStatus, e.toStatus])).toEqual([
      ["ORDER_STARTED", null, "Received"],
      ["FIELDS_CONFIRMED", "Received", "Confirmed"],
    ]);
    expect(row.events[1]).toMatchObject({
      actorKind: "user",
      actorUserId: actors.SUPPORT.userId,
      actorName: "Test SUPPORT",
    });
    // Exactly the moment the machine was given, not when the row was written.
    expect(row.events[1]?.occurredAt.getTime()).toBe(clock);
    expect(row.startedAt.getTime()).toBe(clock - 1000);
    await expect(auditActions(ref)).resolves.toEqual([
      "workflow.started",
      "workflow.transition",
    ]);
  });

  it("carries the machine's facts from one transition to the next", async () => {
    const ref = orderRef();
    await workflow.start(
      ref,
      { prepaymentDue: "500.00" },
      actors.SUPPORT,
      INFO,
      tick(),
    );
    await applyAny(
      ref,
      { type: "FIELDS_CONFIRMED", allFieldsConfirmed: true },
      actors.SUPPORT,
    );
    await applyAny(
      ref,
      { type: "STOCK_CHECKED", stockCoversOrder: true },
      actors.PRODUCT_MANAGER,
    );
    await applyAny(ref, { type: "PI_SENT" }, actors.SUPPORT);

    // The prepayment set at the start still holds the gate shut three moves on.
    const error = await applyAny(
      ref,
      { type: "PACKING_STARTED" },
      actors.WAREHOUSE,
    ).catch(codeOf);
    expect(error).toBe("CONFLICT");

    await applyAny(
      ref,
      {
        type: "PAYMENT_CONFIRMED",
        paymentType: "prepayment",
        amount: "500.00",
      },
      actors.FINANCE,
    );
    await applyAny(ref, { type: "PACKING_STARTED" }, actors.WAREHOUSE);
    await expect(workflow.statusOf(ref)).resolves.toMatchObject({
      status: "Packing",
      navisionStatus: "Released",
    });
  });

  it("holds an order on a failed check, and returns it when the hold clears", async () => {
    const ref = orderRef();
    await orderAwaitingSpr(ref);

    await workflow.apply(
      ref,
      { type: "HOLD_RAISED", source: "check", reason: "Quantity differs" },
      SYSTEM,
      INFO,
      tick(),
    );
    await expect(workflow.statusOf(ref)).resolves.toMatchObject({
      status: "OnHold",
      holds: ["check"],
      resumeTo: "AwaitingSpr",
    });

    const held = await rows(ref);
    expect(held.events.at(-1)).toMatchObject({
      actorKind: "system",
      actorUserId: null,
      actorName: "checks",
      data: { source: "check", reason: "Quantity differs" },
    });

    await workflow.apply(
      ref,
      { type: "HOLD_CLEARED", source: "check" },
      SYSTEM,
      INFO,
      tick(),
    );
    await expect(workflow.statusOf(ref)).resolves.toMatchObject({
      status: "AwaitingSpr",
      holds: [],
      resumeTo: null,
    });
  });

  it("marks a finished order as completed, with no current step", async () => {
    const ref = orderRef();
    await workflow.start(
      ref,
      { prepaymentDue: null },
      actors.SUPPORT,
      INFO,
      tick(),
    );
    await applyAny(
      ref,
      { type: "CANCELLED", reason: "The customer withdrew the PO" },
      actors.SUPPORT,
    );

    const row = await rows(ref);
    expect(row).toMatchObject({ status: "Cancelled", currentStep: null });
    expect(row.completedAt?.getTime()).toBe(clock);
  });

  it("refuses starting the same order twice, however close together", async () => {
    const ref = orderRef();
    const results = await Promise.allSettled([
      workflow.start(
        ref,
        { prepaymentDue: null },
        actors.SUPPORT,
        INFO,
        tick(),
      ),
      workflow.start(
        ref,
        { prepaymentDue: null },
        actors.SUPPORT,
        INFO,
        tick(),
      ),
    ]);

    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const refused = results.find((r) => r.status === "rejected");
    expect(codeOf(refused?.reason)).toBe("CONFLICT");

    const row = await rows(ref);
    expect(row.events).toHaveLength(1);
    await expect(auditActions(ref)).resolves.toEqual([
      "workflow.started",
      "workflow.transition.refused",
    ]);
  });

  it("stores nothing when the audit event for a start fails", async () => {
    const ref = orderRef();
    const spy = vi
      .spyOn(audit, "record")
      .mockRejectedValueOnce(new Error("the audit writer failed"));

    await expect(
      workflow.start(
        ref,
        { prepaymentDue: null },
        actors.SUPPORT,
        INFO,
        tick(),
      ),
    ).rejects.toThrow("the audit writer failed");
    spy.mockRestore();

    await expect(
      database.client.workflowInstance.count({ where: { orderRef: ref } }),
    ).resolves.toBe(0);
  });

  it("audits an illegal transition, and leaves the order as it was", async () => {
    const ref = orderRef();
    await workflow.start(
      ref,
      { prepaymentDue: null },
      actors.SUPPORT,
      INFO,
      tick(),
    );

    const error = await applyAny(
      ref,
      { type: "PI_SENT" },
      actors.SUPPORT,
    ).catch(codeOf);

    expect(error).toBe("CONFLICT");
    const row = await rows(ref);
    expect(row).toMatchObject({ status: "Received", version: 0 });
    expect(row.events).toHaveLength(1);
    await expect(auditActions(ref)).resolves.toEqual([
      "workflow.started",
      "workflow.transition.refused",
    ]);
  });

  it("rolls back the whole transition when one step of it fails", async () => {
    const ref = orderRef();
    await workflow.start(
      ref,
      { prepaymentDue: null },
      actors.SUPPORT,
      INFO,
      tick(),
    );

    const spy = vi
      .spyOn(audit, "record")
      .mockRejectedValueOnce(new Error("the audit writer failed"));
    await expect(
      applyAny(
        ref,
        { type: "FIELDS_CONFIRMED", allFieldsConfirmed: true },
        actors.SUPPORT,
      ),
    ).rejects.toThrow("the audit writer failed");
    spy.mockRestore();

    const row = await rows(ref);
    expect(row).toMatchObject({ status: "Received", version: 0 });
    expect(row.events).toHaveLength(1);
  });

  it("refuses a seeded sample order, whose label is not a real status", async () => {
    const sample = await database.client.workflowInstance.findFirstOrThrow({
      where: { status: { startsWith: "sample-" } },
    });

    await expect(workflow.statusOf(sample.orderRef)).resolves.toBeNull();
    const error = await applyAny(
      sample.orderRef,
      { type: "PI_SENT" },
      actors.SUPPORT,
    ).catch(codeOf);
    expect(error).toBe("CONFLICT");
  });

  it("treats a real status with no facts as a sample, and damaged facts as damage", async () => {
    const definition =
      await database.client.workflowDefinition.findFirstOrThrow();
    const noFacts = orderRef();
    const damaged = orderRef();
    await database.client.workflowInstance.create({
      data: {
        definitionId: definition.id,
        orderRef: noFacts,
        status: "Packing",
      },
    });
    await database.client.workflowInstance.create({
      data: {
        definitionId: definition.id,
        orderRef: damaged,
        status: "Packing",
        facts: { prepaymentDue: "not a number" },
      },
    });

    await expect(workflow.statusOf(noFacts)).resolves.toBeNull();
    await expect(workflow.statusOf(damaged)).rejects.toThrow();
  });

  describe("what area 3 reads and reports", () => {
    const completed = (
      ref: string,
      ruleId: string,
      outcome: "pass" | "fail",
    ) => ({
      event: "check.completed" as const,
      orderNo: ref,
      ruleId,
      outcome,
      resultId: `result-${ruleId}`,
      evidence: [],
    });

    it("answers the status port with who holds the order, and since when", async () => {
      const ref = orderRef();
      await workflow.start(
        ref,
        { prepaymentDue: null },
        actors.SUPPORT,
        INFO,
        tick(),
      );

      const reader = t.app.get(WorkflowOrderStatusReader);
      const report = await reader.statusOf(ref);
      expect(report).toMatchObject({
        orderNo: ref,
        status: { code: "Received", label: "PO received" },
        ownerRole: "SUPPORT",
        open: true,
      });
      expect(Number.isNaN(Date.parse(report?.since ?? ""))).toBe(false);

      await expect(reader.statusOf("SO-NOT-THERE")).resolves.toBeNull();
      const many = await reader.statusOfMany([ref, "SO-NOT-THERE"]);
      expect([...many.keys()]).toEqual([ref]);
    });

    it("says a finished order is not open", async () => {
      const ref = orderRef();
      await workflow.start(
        ref,
        { prepaymentDue: null },
        actors.SUPPORT,
        INFO,
        tick(),
      );
      await applyAny(
        ref,
        { type: "CANCELLED", reason: "Withdrawn" },
        actors.SUPPORT,
      );

      await expect(
        t.app.get(WorkflowOrderStatusReader).statusOf(ref),
      ).resolves.toMatchObject({ open: false, ownerRole: "SUPPORT" });
    });

    it("holds an order on a failed check, until that same rule passes", async () => {
      const ref = orderRef();
      const reporter = t.app.get(WorkflowCheckReporter);
      await orderAwaitingSpr(ref);

      await reporter.report(completed(ref, "packing-qty", "fail"));
      await reporter.report(completed(ref, "po-total", "fail"));
      // A check that runs again changes nothing.
      await reporter.report(completed(ref, "po-total", "fail"));
      await expect(workflow.statusOf(ref)).resolves.toMatchObject({
        status: "OnHold",
        holds: ["check:packing-qty", "check:po-total"],
      });

      // Another rule passing must not free it.
      await reporter.report(completed(ref, "price-list", "pass"));
      await reporter.report(completed(ref, "po-total", "pass"));
      await expect(workflow.statusOf(ref)).resolves.toMatchObject({
        status: "OnHold",
        holds: ["check:packing-qty"],
      });

      await reporter.report(completed(ref, "packing-qty", "pass"));
      await expect(workflow.statusOf(ref)).resolves.toMatchObject({
        status: "AwaitingSpr",
        holds: [],
      });
    });

    it("ignores a report on an order it does not run, or one that has finished", async () => {
      const reporter = t.app.get(WorkflowCheckReporter);
      await expect(
        reporter.report(completed("SO-NOT-THERE", "po-total", "fail")),
      ).resolves.toBeUndefined();

      const ref = orderRef();
      await workflow.start(
        ref,
        { prepaymentDue: null },
        actors.SUPPORT,
        INFO,
        tick(),
      );
      await applyAny(
        ref,
        { type: "CANCELLED", reason: "Withdrawn" },
        actors.SUPPORT,
      );
      await reporter.report(completed(ref, "po-total", "fail"));
      await expect(workflow.statusOf(ref)).resolves.toMatchObject({
        status: "Cancelled",
      });
    });
  });

  describe("deciding an SPR through area 4's policy", () => {
    it("approves within the approver's purchase limit", async () => {
      const ref = orderRef();
      await orderAwaitingSpr(ref);

      await workflow.decideSpr(
        ref,
        { type: "SPR_APPROVED" },
        spr("4999.99"),
        actors.APPROVER,
        INFO,
        tick(),
      );

      await expect(workflow.statusOf(ref)).resolves.toMatchObject({
        status: "SprApproved",
      });
    });

    it("refuses above the limit, and leaves the order waiting", async () => {
      const ref = orderRef();
      await orderAwaitingSpr(ref);

      const error = await workflow
        .decideSpr(
          ref,
          { type: "SPR_APPROVED" },
          spr("5000.01"),
          actors.APPROVER,
          INFO,
          tick(),
        )
        .catch(codeOf);

      expect(error).toBe("FORBIDDEN");
      await expect(workflow.statusOf(ref)).resolves.toMatchObject({
        status: "AwaitingSpr",
      });
    });

    it("refuses a requester approving their own SPR", async () => {
      const ref = orderRef();
      await orderAwaitingSpr(ref);

      const error = await workflow
        .decideSpr(
          ref,
          { type: "SPR_APPROVED" },
          { ...spr("10.00"), requesterUserId: actors.APPROVER.userId },
          actors.APPROVER,
          INFO,
          tick(),
        )
        .catch(codeOf);

      expect(error).toBe("FORBIDDEN");
      await expect(workflow.statusOf(ref)).resolves.toMatchObject({
        status: "AwaitingSpr",
      });
    });

    it("returns a rejected SPR to the stock check, with the reason on the event", async () => {
      const ref = orderRef();
      await orderAwaitingSpr(ref);

      await workflow.decideSpr(
        ref,
        { type: "SPR_REJECTED", reason: "Wrong vendor" },
        spr("100.00"),
        actors.APPROVER,
        INFO,
        tick(),
      );

      const row = await rows(ref);
      expect(row.status).toBe("StockChecked");
      expect(row.events.at(-1)).toMatchObject({
        type: "SPR_REJECTED",
        fromStatus: "AwaitingSpr",
        toStatus: "StockChecked",
        data: { reason: "Wrong vendor" },
      });

      // The shortfall has not gone away, so the PI stays blocked.
      const error = await applyAny(
        ref,
        { type: "PI_SENT" },
        actors.SUPPORT,
      ).catch(codeOf);
      expect(error).toBe("CONFLICT");
    });

    it("lets only one of two decisions at the same moment win", async () => {
      const ref = orderRef();
      await orderAwaitingSpr(ref);

      // Both must read the order before either saves, or the second is refused
      // by the machine and the lock never has anything to do.
      const repository = t.app.get(OrderWorkflowRepository);
      const realFind = repository.find.bind(repository);
      let release: () => void = () => undefined;
      const bothRead = new Promise<void>((resolve) => {
        release = resolve;
      });
      let reads = 0;
      const spy = vi.spyOn(repository, "find").mockImplementation(async (r) => {
        const found = await realFind(r);
        reads += 1;
        if (reads === 2) release();
        await bothRead;
        return found;
      });

      const results = await Promise.allSettled([
        workflow.decideSpr(
          ref,
          { type: "SPR_APPROVED" },
          spr("100.00"),
          actors.APPROVER,
          INFO,
          tick(),
        ),
        workflow.decideSpr(
          ref,
          { type: "SPR_REJECTED", reason: "Wrong vendor" },
          spr("100.00"),
          actors.APPROVER,
          INFO,
          tick(),
        ),
      ]);

      spy.mockRestore();

      expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
      const lost = results.find((r) => r.status === "rejected");
      expect(codeOf(lost?.reason)).toBe("CONFLICT");
      await expect(auditActions(ref)).resolves.toContain(
        "workflow.transition.refused",
      );
      const row = await rows(ref);
      expect(
        row.events.filter(
          (e) => e.type.startsWith("SPR_") && e.type !== "SPR_RAISED",
        ),
      ).toHaveLength(1);
      expect(row.version).toBe(4);
    });
  });

  it("keeps the audit chain whole after all of this", async () => {
    await expect(audit.verify()).resolves.toMatchObject({ ok: true });
  });
});
