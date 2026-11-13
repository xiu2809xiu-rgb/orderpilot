import { COMPLETABLE_TASK_KINDS, type WorkflowTask } from "@orderpilot/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "@/components/common";
import {
  workflowsCompleteTask,
  workflowsUndoTask,
} from "@/lib/api/generated/endpoints/workflows/workflows";

const COMPLETES: readonly string[] = COMPLETABLE_TASK_KINDS;

/** True when one click finishes the task. Approvals and payments are decided on their own page. */
export function canComplete(task: WorkflowTask): boolean {
  return COMPLETES.includes(task.kind);
}

/**
 * Finishes a task through the real API, as the app's own home does, and lets
 * the caller note it in Done today. The toast's Undo reverses it and tells the
 * caller to take it out again. Every list reads from the server, so asking
 * them all again is what moves the row.
 */
export function useCompleteTask({
  onDone,
  onUndone,
}: {
  onDone: (task: WorkflowTask, at: Date) => void;
  onUndone: (task: WorkflowTask) => void;
}) {
  const { t } = useTranslation("home");
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: (task: WorkflowTask) => workflowsCompleteTask(task.id),
    onSuccess: async (_answer, task) => {
      onDone(task, new Date());
      await queryClient.invalidateQueries();
      toast.done(t(`needs.done.${task.kind}`, { orderNo: task.orderNo }), {
        undo: async () => {
          await workflowsUndoTask(task.id);
          onUndone(task);
          await queryClient.invalidateQueries();
        },
      });
    },
    onError: async (_error, task) => {
      toast.failed(t("needs.failed", { orderNo: task.orderNo }));
      await queryClient.invalidateQueries();
    },
  });
  return {
    isBusy: (task: WorkflowTask) =>
      mutation.isPending && mutation.variables.id === task.id,
    complete: (task: WorkflowTask) => {
      if (!mutation.isPending) mutation.mutate(task);
    },
  };
}
