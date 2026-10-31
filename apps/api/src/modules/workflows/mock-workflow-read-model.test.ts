import {
  INBOX_ROLES,
  orderFlowSchema,
  sprDetailSchema,
  workflowReminderSchema,
  workflowTaskSchema,
} from "@orderpilot/shared";
import { createSyntheticDataset } from "@orderpilot/synthetic-data";
import { describe, expect, it } from "vitest";
import type { DocumentConfigRepository } from "./document-config.repository.js";
import { SprSuggestion } from "./domain/spr-suggestion.js";
import { MockApprovalPolicy } from "./mock/mock-approval-policy.js";
import { MockWorkflowReadModel } from "./mock-workflow-read-model.js";
import { WorkflowsService } from "./workflows.service.js";

const dataset = createSyntheticDataset();
const model = new MockWorkflowReadModel(() => dataset);
const orders = dataset.orders;

describe("the mock read model", () => {
  it("gives every inbox role a full inbox of valid tasks", async () => {
    for (const role of INBOX_ROLES) {
      const tasks = await model.tasksFor(role);
      expect(tasks.length, role).toBeGreaterThanOrEqual(8);
      for (const task of tasks) {
        expect(workflowTaskSchema.safeParse(task).success, task.id).toBe(true);
        expect(task.assigneeRole).toBe(role);
        expect(task.customerName).toBeTruthy();
        expect(task.priority).toBeTruthy();
      }
    }
  });

  it("builds a valid flow for every sample order, with one current step at most", async () => {
    for (const order of orders) {
      const flow = await model.flowOf(order.header.no);
      expect(orderFlowSchema.safeParse(flow).success, order.header.no).toBe(
        true,
      );
      const current = flow?.steps.filter((step) => step.state === "current");
      expect(current?.length).toBeLessThanOrEqual(1);
    }
    expect(await model.flowOf("SO-9999")).toBeNull();
  });

  it("shows the prepayment due on an order that waits for one, and the paid one after", async () => {
    const waiting = orders.find((o) => o.scenario.kind === "awaiting-payment");
    if (waiting?.scenario.kind !== "awaiting-payment") throw new Error("none");
    const flow = await model.flowOf(waiting.header.no);
    expect(flow?.payment.amountDue).toBe(waiting.scenario.amountDue);
    expect(flow?.payment.confirmations).toHaveLength(0);

    const paid = dataset.payments.find((p) => p.status === "confirmed");
    const afterwards = await model.flowOf(paid?.orderNo ?? "");
    expect(afterwards?.payment.confirmations.map((c) => c.id)).toContain(
      paid?.id,
    );
  });

  it("numbers the SPRs the OrderPilot way, with Navision's number beside", async () => {
    const approved = dataset.sprs.find((s) => s.status === "approved");
    const suggested = dataset.sprs.find((s) => s.status === "suggested");
    const spr = await model.sprByRecordNo(approved?.recordNo ?? "");
    expect(spr?.ref).toEqual({
      recordNo: approved?.recordNo,
      navisionNo: approved?.navisionNo,
    });
    expect(spr?.ref.navisionNo).toMatch(/^PO-\d{4}$/);
    expect((await model.sprByRecordNo(suggested?.recordNo ?? ""))?.ref).toEqual(
      { recordNo: suggested?.recordNo, navisionNo: null },
    );
    const origins = spr?.fields.map((field) => [field.key, field.origin]);
    expect(origins).toContainEqual(["quantity", "suggested"]);
    expect(origins).toContainEqual(["deliveryTerms", "default"]);
  });

  it("holds every SPR to the formula in prompt 002", async () => {
    for (const row of dataset.sprs) {
      const spr = await model.sprByRecordNo(row.recordNo);
      const item = dataset.items.find((i) => i.no === row.itemNo);
      if (!spr || !item) throw new Error("missing");
      expect(spr.basis).toEqual(
        SprSuggestion.fromShortfall({
          ordered: row.basis.ordered,
          inventory: item.inventory,
          qtyOnSalesOrder: item.qtyOnSalesOrder,
          qtyOnPurchOrder: item.qtyOnPurchOrder,
        }),
      );
    }
  });

  it("keeps each reminder valid and with its own role", async () => {
    for (const role of INBOX_ROLES) {
      const reminders = await model.remindersFor(role);
      for (const reminder of reminders) {
        expect(workflowReminderSchema.safeParse(reminder).success).toBe(true);
        expect(reminder.toRole).toBe(role);
      }
    }
  });

  it("follows the dataset when the day, and so the set, changes", async () => {
    let current = createSyntheticDataset({ referenceDate: "2026-11-02" });
    const moving = new MockWorkflowReadModel(() => current);
    const before = await moving.tasksFor("FINANCE");
    current = createSyntheticDataset({ referenceDate: "2026-11-23" });
    const after = await moving.tasksFor("FINANCE");
    expect(after.map((t) => t.dueAt)).not.toEqual(before.map((t) => t.dueAt));
    expect((await moving.flowOf("SO-0001"))?.order.orderDate).toBe(
      current.orders[0]?.header.orderDate,
    );
  });
});

describe("the service over the mock", () => {
  const config = {
    list: () => Promise.resolve([]),
  } as unknown as DocumentConfigRepository;
  const service = new WorkflowsService(model, new MockApprovalPolicy(), config);
  const sprNo = dataset.sprs[0]?.recordNo ?? "";

  it("adds the approver in the shape of Navision's Approval User Setup", async () => {
    const spr = await service.spr(sprNo);
    expect(sprDetailSchema.safeParse(spr).success).toBe(true);
    expect(spr.approver.setup).toMatchObject({
      purchaseAmountApprovalLimit: "5000.00",
      unlimitedPurchaseApproval: false,
    });
  });

  it("answers every SPR in the contract's shape", async () => {
    for (const row of dataset.sprs) {
      expect(
        sprDetailSchema.safeParse(await service.spr(row.recordNo)).success,
        row.recordNo,
      ).toBe(true);
    }
  });

  it("puts overdue tasks first, then high priority", async () => {
    const page = await service.tasks("LOGISTICS", { page: 1, pageSize: 25 });
    expect(page.items[0]?.overdue).toBe(true);
    const overdue = page.items.filter((t) => t.overdue);
    expect(page.items.slice(0, overdue.length)).toEqual(overdue);
  });

  it("pages, and filters by kind, priority and overdue, on the server", async () => {
    const all = await service.tasks("FINANCE", { page: 1, pageSize: 5 });
    expect(all.items).toHaveLength(5);
    expect(all.meta.total).toBe(
      dataset.tasks.filter((t) => t.assigneeRole === "FINANCE").length,
    );
    const second = await service.tasks("FINANCE", { page: 2, pageSize: 5 });
    expect(second.items[0]?.id).not.toBe(all.items[0]?.id);

    const high = await service.tasks("FINANCE", {
      page: 1,
      pageSize: 25,
      priority: "high",
    });
    expect(high.items.every((t) => t.priority === "high")).toBe(true);
    expect(high.meta.total).toBeGreaterThan(0);

    const late = await service.tasks("FINANCE", {
      page: 1,
      pageSize: 25,
      overdue: "true",
    });
    expect(late.items.every((t) => t.overdue)).toBe(true);

    const kind = await service.tasks("FINANCE", {
      page: 1,
      pageSize: 25,
      kind: "PACK_ORDER",
    });
    expect(kind.meta.total).toBe(0);
  });

  it("says a decision changed nothing", async () => {
    const result = await service.decide(sprNo, "approved", "Fine.");
    expect(result).toMatchObject({ applied: false, outcome: "approved" });
  });

  it("refuses an unknown SPR or order", async () => {
    await expect(
      service.decide("SPR-20261102-9999", "rejected", "No."),
    ).rejects.toThrow();
    await expect(service.flow("SO-9999")).rejects.toThrow();
  });
});
