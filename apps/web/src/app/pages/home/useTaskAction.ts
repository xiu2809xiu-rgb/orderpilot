import type { WorkflowTask } from "@orderpilot/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "@/components/common";
import {
  workflowsApprove,
  workflowsCompleteTask,
  workflowsConfirmPayment,
  workflowsUndoDecision,
  workflowsUndoPayment,
  workflowsUndoTask,
} from "@/lib/api/generated/endpoints/workflows/workflows";
import { todayInSingapore } from "@/lib/format";

const COMPLETES: readonly string[] = [
  "RAISE_SPR",
  "SEND_PI",
  "PACK_ORDER",
  "ADD_SHIPPING_DOCUMENTS",
];

/** True when one click finishes the task. Any other task opens its order. */
export function isOneClick(task: WorkflowTask): boolean {
  if (COMPLETES.includes(task.kind)) return true;
  if (task.kind === "APPROVE_SPR") return task.ref !== null;
  return task.kind === "CONFIRM_PAYMENT" && task.expectedPayment !== undefined;
}

/** Does the task, and answers with the call that reverses it. */
async function perform(
  task: WorkflowTask,
  comment: string,
): Promise<() => Promise<unknown>> {
  if (task.kind === "APPROVE_SPR" && task.ref) {
    const { recordNo } = task.ref;
    await workflowsApprove(recordNo, { comment });
    return () => workflowsUndoDecision(recordNo);
  }
  if (task.kind === "CONFIRM_PAYMENT" && task.expectedPayment && task.orderNo) {
    const { orderNo } = task;
    const { paymentType, amount, currencyCode } = task.expectedPayment;
    const answer = await workflowsConfirmPayment(orderNo, {
      paymentType,
      amount,
      currencyCode,
      reference: `HOME-${orderNo}`,
      paidOn: todayInSingapore(),
    });
    return () => workflowsUndoPayment(orderNo, answer.data.paymentId);
  }
  await workflowsCompleteTask(task.id);
  return () => workflowsUndoTask(task.id);
}

/**
 * The one-click action on a task. Every list and count on the page reads from
 * the server, so asking them all again is what moves the row, the tile and the
 * bell, and the toast's Undo does the same in reverse.
 */
export function useTaskAction() {
  const { t } = useTranslation("home");
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (task: WorkflowTask) =>
      perform(task, t("needs.approvedComment")),
    onSuccess: async (undo, task) => {
      await queryClient.invalidateQueries();
      toast.done(t(`needs.done.${task.kind}`, { orderNo: task.orderNo }), {
        undo: async () => {
          await undo();
          await queryClient.invalidateQueries();
        },
      });
    },
    onError: (_error, task) => {
      toast.failed(t("needs.failed", { orderNo: task.orderNo }));
    },
  });
}
