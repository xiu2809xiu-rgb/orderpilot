import { beforeEach, describe, expect, it, vi } from "vitest";
import { demoLogin } from "@/lib/api/auth";
import {
  workflowsOrderFlow,
  workflowsUndoDecision,
  workflowsUndoPayment,
  workflowsUndoTask,
} from "@/lib/api/generated/endpoints/workflows/workflows";
import { undoTour } from "./tourUndo";

vi.mock("@/lib/api/auth", () => ({ demoLogin: vi.fn() }));
vi.mock("@/lib/api/generated/endpoints/workflows/workflows", () => ({
  workflowsOrderFlow: vi.fn(),
  workflowsUndoDecision: vi.fn(),
  workflowsUndoPayment: vi.fn(),
  workflowsUndoTask: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("putting the tour's actions back", () => {
  it("undoes as the role that acted, newest first, signing in only when the role changes", async () => {
    const result = await undoTour(
      [
        { kind: "task", role: "SUPPORT", taskId: "t-1" },
        { kind: "task", role: "WAREHOUSE", taskId: "t-2" },
        { kind: "task", role: "WAREHOUSE", taskId: "t-3" },
      ],
      "WAREHOUSE",
      "APPROVER",
    );
    expect(vi.mocked(workflowsUndoTask).mock.calls.map(([id]) => id)).toEqual([
      "t-3",
      "t-2",
      "t-1",
    ]);
    // Already Warehouse: no sign-in for its two, one for Support, one to end as the approver.
    expect(vi.mocked(demoLogin).mock.calls.map(([role]) => role)).toEqual([
      "SUPPORT",
      "APPROVER",
    ]);
    expect(result).toEqual({ undone: 3, failed: 0 });
  });

  it("needs no sign-in at all when every action is the signed-in role's", async () => {
    await undoTour(
      [{ kind: "spr", recordNo: "SPR-1" }],
      "APPROVER",
      "APPROVER",
    );
    expect(workflowsUndoDecision).toHaveBeenCalledWith("SPR-1");
    expect(demoLogin).not.toHaveBeenCalled();
  });

  it("finds the payment Home confirmed and undoes that one", async () => {
    vi.mocked(workflowsOrderFlow).mockResolvedValue({
      data: {
        payment: {
          confirmations: [
            { id: "p-other", reference: "BANK-1" },
            { id: "p-home", reference: "HOME-SO-0005" },
          ],
        },
      },
    } as never);
    await undoTour(
      [{ kind: "payment", orderNo: "SO-0005" }],
      "FINANCE",
      "FINANCE",
    );
    expect(workflowsUndoPayment).toHaveBeenCalledWith("SO-0005", "p-home");
  });

  it("carries on past one that fails, and counts it", async () => {
    vi.mocked(workflowsUndoTask).mockRejectedValueOnce(new Error("gone"));
    const result = await undoTour(
      [
        { kind: "task", role: "SUPPORT", taskId: "t-1" },
        { kind: "task", role: "SUPPORT", taskId: "t-2" },
      ],
      "SUPPORT",
      "SUPPORT",
    );
    expect(result).toEqual({ undone: 1, failed: 1 });
  });
});
