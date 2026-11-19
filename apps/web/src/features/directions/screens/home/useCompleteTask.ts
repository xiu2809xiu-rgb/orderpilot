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
 * True when the task is one a person simply marks as done. The order page
 * imports this by name for the same question, so it keeps its meaning.
 */
export function canComplete(task: WorkflowTask): boolean {
  return COMPLETES.includes(task.kind);
}

/**
 * True when one click does the task here: the kinds a person simply marks as done
 * and a payment whose expected amount is known. Anything else opens its record.
 * An SPR approval never does: the approver decides on the stock, the cover and
 * the amount, and says why, which only the SPR page shows and asks for.
 */
export function isOneClick(task: WorkflowTask): boolean {
  if (canComplete(task)) return true;
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
 * The one-click action on a task, through the real API. Every list and count
 * on the page reads from the server, so asking them all again is what moves
 * the row, the tile and the bell, and the toast's Undo does the same in
 * reverse. A failed action asks too: the task may have been done in another
 * tab, and then its row must go. The caller notes what was finished in Done
 * today and takes it out again on Undo.
 */
export function useCompleteTask({
  onDone,
  onUndone,
}: {
  onDone: (task: WorkflowTask, at: Date) => void;
  /** Called just before an Undo asks the lists again, so focus can follow the row back. */
  onUndone: (task: WorkflowTask) => void;
}) {
  const { t } = useTranslation("home");
  const { t: tNext, i18n } = useTranslation("directions-home");
  const queryClient = useQueryClient();
  // The button only disables on the next render, so a double click would get
  // here twice. A ref is set at once.
  const working = useRef(new Set<string>());
  const mutation = useMutation({
    mutationFn: perform,
    onSuccess: async (undo, task) => {
      onDone(task, new Date());
      await queryClient.invalidateQueries();
      // Who has the order next, from the sales flow's nine steps. A kind that
      // cannot be placed keeps the plain message: a guess here would be a claim.
      const nextKey = `needs.next.${task.kind}`;
      const next = i18n.exists(nextKey, { ns: "directions-home" })
        ? tNext(nextKey)
        : undefined;
      toast.done(t(`needs.done.${task.kind}`, { orderNo: task.orderNo }), {
        description: next,
        action: task.orderNo
          ? {
              label: tNext("needs.openOrder"),
              to: `/orders/${task.orderNo}`,
            }
          : undefined,
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
    complete: (task: WorkflowTask) => {
      if (working.current.has(task.id)) return;
      working.current.add(task.id);
      mutation.mutate(task);
    },
  };
}
