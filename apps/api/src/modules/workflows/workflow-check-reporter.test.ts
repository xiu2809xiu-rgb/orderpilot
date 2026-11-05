import { describe, expect, it, vi } from "vitest";
import { ConflictError } from "../../common/domain-error.js";
import type {
  OrderStatusView,
  OrderWorkflowService,
} from "./order-workflow.service.js";
import { WorkflowCheckReporter } from "./workflow-check-reporter.js";

const failed = {
  event: "check.completed" as const,
  orderNo: "SO-0001",
  ruleId: "po-total",
  outcome: "fail" as const,
  resultId: "result-1",
  evidence: [],
};

function view(changes: Partial<OrderStatusView> = {}): OrderStatusView {
  return {
    orderRef: "SO-0001",
    status: "Packing",
    navisionStatus: "Released",
    holds: [],
    resumeTo: null,
    currentStep: "invoiced",
    ownerRole: "SUPPORT",
    since: new Date("2026-11-06T02:00:00.000Z"),
    open: true,
    ...changes,
  };
}

function setUp(views: readonly OrderStatusView[], applyErrors: Error[] = []) {
  let reads = 0;
  const workflow = {
    statusOf: vi.fn(() => {
      const next = views[Math.min(reads, views.length - 1)] ?? null;
      reads += 1;
      return Promise.resolve(next);
    }),
    apply: vi.fn(() => {
      const error = applyErrors.shift();
      return error ? Promise.reject(error) : Promise.resolve();
    }),
  };
  return {
    workflow,
    reporter: new WorkflowCheckReporter(
      workflow as unknown as OrderWorkflowService,
    ),
  };
}

describe("WorkflowCheckReporter, when another move gets in first", () => {
  it("reads the order again and still holds it, so a failed check is never lost", async () => {
    const { reporter, workflow } = setUp(
      [view(), view({ status: "Invoiced" })],
      [new ConflictError("Someone else moved this order first.")],
    );

    await reporter.report(failed);

    expect(workflow.apply).toHaveBeenCalledTimes(2);
    expect(workflow.statusOf).toHaveBeenCalledTimes(2);
  });

  it("stops once the second read shows the same rule already holds the order", async () => {
    const { reporter, workflow } = setUp(
      [view(), view({ status: "OnHold", holds: ["check:po-total"] })],
      [new ConflictError("It already has that hold.")],
    );

    await reporter.report(failed);

    expect(workflow.apply).toHaveBeenCalledOnce();
  });

  it("stops once the second read shows the order has finished", async () => {
    const { reporter, workflow } = setUp(
      [view(), view({ status: "Cancelled", open: false })],
      [new ConflictError("An order at Cancelled cannot take HOLD_RAISED.")],
    );

    await reporter.report(failed);

    expect(workflow.apply).toHaveBeenCalledOnce();
  });

  it("gives up after three tries and says so, rather than losing it quietly", async () => {
    const conflict = () => new ConflictError("Someone else moved it first.");
    const { reporter, workflow } = setUp(
      [view()],
      [conflict(), conflict(), conflict()],
    );

    await expect(reporter.report(failed)).rejects.toThrow(ConflictError);
    expect(workflow.apply).toHaveBeenCalledTimes(3);
  });

  it("does not retry anything but a conflict", async () => {
    const { reporter, workflow } = setUp(
      [view()],
      [new Error("database down")],
    );

    await expect(reporter.report(failed)).rejects.toThrow("database down");
    expect(workflow.apply).toHaveBeenCalledOnce();
  });
});
