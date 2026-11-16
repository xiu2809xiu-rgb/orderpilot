import type { Role } from "@orderpilot/shared";
import { demoLogin } from "@/lib/api/auth";
import {
  workflowsOrderFlow,
  workflowsUndoDecision,
  workflowsUndoPayment,
  workflowsUndoTask,
} from "@/lib/api/generated/endpoints/workflows/workflows";
import type { TourUndo } from "@/stores/demoTour";

/** Who may put each thing back: the role that did it. */
function roleFor(entry: TourUndo): Role {
  if (entry.kind === "task") return entry.role;
  return entry.kind === "spr" ? "APPROVER" : "FINANCE";
}

/** Home confirms a payment with this reference (`useCompleteTask`). */
const homeReference = (orderNo: string) => `HOME-${orderNo}`;

async function undoOne(entry: TourUndo): Promise<void> {
  if (entry.kind === "task") {
    await workflowsUndoTask(entry.taskId);
    return;
  }
  if (entry.kind === "spr") {
    await workflowsUndoDecision(entry.recordNo);
    return;
  }
  const flow = await workflowsOrderFlow(entry.orderNo);
  const paid = flow.data.payment.confirmations.findLast(
    (payment) => payment.reference === homeReference(entry.orderNo),
  );
  if (paid) await workflowsUndoPayment(entry.orderNo, paid.id);
}

/**
 * Puts back what the tour did, newest first, each as the role that did it, so
 * the next run finds the same sample data. One that fails, because someone
 * undid it already, does not stop the rest. Ends signed in as `endRole`.
 */
export async function undoTour(
  entries: readonly TourUndo[],
  endRole: Role,
): Promise<{ undone: number; failed: number }> {
  let undone = 0;
  let failed = 0;
  let current: Role | null = null;
  for (const entry of [...entries].reverse()) {
    const role = roleFor(entry);
    try {
      if (role !== current) {
        await demoLogin(role);
        current = role;
      }
      await undoOne(entry);
      undone += 1;
    } catch {
      failed += 1;
    }
  }
  if (current !== endRole) await demoLogin(endRole);
  return { undone, failed };
}
