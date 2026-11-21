import { COMPLETABLE_TASK_KINDS, type WorkflowTask } from "@orderpilot/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "@/components/common";
import {
  workflowsCompleteTask,
  workflowsUndoTask,
} from "@/lib/api/generated/endpoints/workflows/workflows";

const COMPLETES: readonly string[] = COMPLETABLE_TASK_KINDS;

/**
 * True when one click does the task: only the kinds a person simply marks as
 * done. A payment never is: it needs the amount, the bank reference and the
 * date a person read from the bank advice, so it opens the order's form and no
 * reference is made up here. An SPR approval never is either: the approver
 * decides on the stock, the cover and the amount, and says why, which only the
 * SPR page shows and asks for. Home and the order page both ask this.
 */
export function canComplete(task: WorkflowTask): boolean {
  return COMPLETES.includes(task.kind);
}

/** Does the task, and answers with the call that reverses it. */
async function perform(task: WorkflowTask): Promise<() => Promise<unknown>> {
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
  offerOrder = true,
}: {
  onDone: (task: WorkflowTask, at: Date) => void;
  /** Called just before an Undo asks the lists again, so focus can follow the row back. */
  onUndone: (task: WorkflowTask) => void;
  /**
   * Whether the toast offers Open order. On Home it does; on the order's own
   * page the button would lead to the page the person is on and change nothing.
   */
  offerOrder?: boolean;
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
      // Only a kind whose next team the order's state machine always fixes has
      // a sentence (needs.next.*): packing, the shipping documents.
      // SEND_PI has none: an order with no prepayment due goes straight to the
      // warehouse. RAISE_SPR has none: a coordinator routes the SPR (ADR 0049).
      // A kind that cannot be placed keeps the plain message: a guess is a claim.
      const nextKey = `needs.next.${task.kind}`;
      const next = i18n.exists(nextKey, { ns: "directions-home" })
        ? tNext(nextKey)
        : undefined;
      toast.done(t(`needs.done.${task.kind}`, { orderNo: task.orderNo }), {
        description: next,
        action:
          offerOrder && task.orderNo
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
