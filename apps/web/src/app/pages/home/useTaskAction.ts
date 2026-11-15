import { COMPLETABLE_TASK_KINDS, type WorkflowTask } from "@orderpilot/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "@/components/common";
import {
  workflowsCompleteTask,
  workflowsConfirmPayment,
  workflowsUndoPayment,
  workflowsUndoTask,
} from "@/lib/api/generated/endpoints/workflows/workflows";
import { todayInSingapore } from "@/lib/format";

const COMPLETES: readonly string[] = COMPLETABLE_TASK_KINDS;

/**
 * True when one click finishes the task. Any other task opens its record. An
 * SPR approval never does: the approver decides on the stock, the cover and the
 * amount, and says why, which only the SPR page shows and asks for.
 */
export function isOneClick(task: WorkflowTask): boolean {
  if (COMPLETES.includes(task.kind)) return true;
  return task.kind === "CONFIRM_PAYMENT" && task.expectedPayment !== undefined;
}

/** Does the task, and answers with the call that reverses it. */
async function perform(task: WorkflowTask): Promise<() => Promise<unknown>> {
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
 * bell, and the toast's Undo does the same in reverse. A failed action asks
 * too: the task may have been done in another tab, and then its row must go.
 */
export function useTaskAction({
  onUndone,
}: {
  /** Called just before an Undo asks the lists again, so focus can follow the row back. */
  onUndone: (task: WorkflowTask) => void;
}) {
  const { t } = useTranslation("home");
  const queryClient = useQueryClient();
  // The button only disables on the next render, so a double click would get
  // here twice. A ref is set at once.
  const working = useRef(new Set<string>());
  const mutation = useMutation({
    mutationFn: perform,
    onSuccess: async (undo, task) => {
      await queryClient.invalidateQueries();
      toast.done(t(`needs.done.${task.kind}`, { orderNo: task.orderNo }), {
        undo: async () => {
          await undo();
          onUndone(task);
          await queryClient.invalidateQueries();
        },
      });
    },
    onError: async (_error, task) => {
      toast.failed(t("needs.failed", { orderNo: task.orderNo }));
      await queryClient.invalidateQueries();
    },
    onSettled: (_answer, _error, task) => {
      working.current.delete(task.id);
    },
  });
  return {
    isBusy: (task: WorkflowTask) =>
      mutation.isPending && mutation.variables.id === task.id,
    act: (task: WorkflowTask) => {
      if (working.current.has(task.id)) return;
      working.current.add(task.id);
      mutation.mutate(task);
    },
  };
}
