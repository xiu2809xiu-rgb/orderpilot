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
import { MockApprovalPolicy } from "./mock/mock-approval-policy.js";
import { MockWorkflowReadModel } from "./mock-workflow-read-model.js";
import { WorkflowsService } from "./workflows.service.js";

const model = new MockWorkflowReadModel();
const orders = createSyntheticDataset().orders;

describe("the mock read model", () => {
  it("gives every inbox role at least one valid task", async () => {
    for (const role of INBOX_ROLES) {
      const tasks = await model.tasksFor(role);
      expect(tasks.length, role).toBeGreaterThan(0);
      for (const task of tasks) {
        expect(workflowTaskSchema.safeParse(task).success, task.id).toBe(true);
        expect(task.assigneeRole).toBe(role);
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

  it("shows the prepayment on the order that waits for one", async () => {
    const flow = await model.flowOf("SO-0004");
    expect(flow?.payment.prepaymentPercent).toBe("50");
    expect(flow?.payment.amountDue).not.toBeNull();
    expect(flow?.payment.confirmations).toHaveLength(0);
  });

  it("numbers the SPRs the OrderPilot way, with Navision's number beside", async () => {
    const spr = await model.sprByRecordNo("SPR-20261102-0001");
    expect(spr?.ref).toEqual({
      recordNo: "SPR-20261102-0001",
      navisionNo: null,
    });
    expect(spr?.basis.shortfall).toBe("98.00");
    const origins = spr?.fields.map((field) => [field.key, field.origin]);
    expect(origins).toContainEqual(["quantity", "suggested"]);
    expect(origins).toContainEqual(["deliveryTerms", "default"]);
  });

  it("keeps each reminder valid and with its own role", async () => {
    for (const role of INBOX_ROLES) {
      for (const reminder of await model.remindersFor(role)) {
        expect(workflowReminderSchema.safeParse(reminder).success).toBe(true);
        expect(reminder.toRole).toBe(role);
      }
    }
  });
});

describe("the service over the mock", () => {
  const config = {
    list: () => Promise.resolve([]),
  } as unknown as DocumentConfigRepository;
  const service = new WorkflowsService(model, new MockApprovalPolicy(), config);

  it("adds the approver in the shape of Navision's Approval User Setup", async () => {
    const spr = await service.spr("SPR-20261102-0001");
    expect(sprDetailSchema.safeParse(spr).success).toBe(true);
    expect(spr.approver.setup).toMatchObject({
      purchaseAmountApprovalLimit: "5000.00",
      unlimitedPurchaseApproval: false,
    });
  });

  it("puts overdue tasks first", async () => {
    const page = await service.tasks(
      "LOGISTICS",
      { page: 1, pageSize: 25 },
      false,
    );
    expect(page.items[0]?.overdue).toBe(true);
  });

  it("says a decision changed nothing", async () => {
    const result = await service.decide(
      "SPR-20261102-0001",
      "approved",
      "Fine.",
    );
    expect(result).toMatchObject({ applied: false, outcome: "approved" });
  });

  it("refuses an unknown SPR or order", async () => {
    await expect(
      service.decide("SPR-20261102-0099", "rejected", "No."),
    ).rejects.toThrow();
    await expect(service.flow("SO-9999")).rejects.toThrow();
  });
});
