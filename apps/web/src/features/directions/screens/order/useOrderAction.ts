import type { WorkflowTask } from "@orderpilot/shared";
import { useWorkflowsMyTasks } from "@/lib/api/generated/endpoints/workflows/workflows";
import { useSessionStore } from "@/stores/session";

/**
 * The one thing this person can do about an order: the open task of theirs
 * that belongs to it, from the same tasks the home screen lists. A role with
 * no inbox, or with no task on this order, has no action here, and the page
 * says so rather than showing a button that does nothing.
 */
export function useOrderAction(orderNo: string): {
  task: WorkflowTask | null;
  isPending: boolean;
} {
  const mayHaveTasks = useSessionStore(
    (state) => state.session?.permissions.includes("tasks.complete") ?? false,
  );
  const tasks = useWorkflowsMyTasks(
    { pageSize: 50 },
    { query: { enabled: mayHaveTasks } },
  );
  const task = tasks.data?.data.find((item) => item.orderNo === orderNo);
  return { task: task ?? null, isPending: mayHaveTasks && tasks.isPending };
}
