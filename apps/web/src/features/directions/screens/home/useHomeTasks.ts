import type { WorkflowTask } from "@orderpilot/shared";
import { useMemo } from "react";
import { useWorkflowsMyTasks } from "@/lib/api/generated/endpoints/workflows/workflows";

/** Most tasks the home screen reads at once: more than any role has open in the data set. */
const LOADED = 50;

// One array for "no tasks yet", so a screen that waits keeps its identity.
const NONE: readonly WorkflowTask[] = [];

/**
 * Earliest due time first, so the longest overdue comes first, which is an
 * order a person can see a reason for on every row. The tasks API sorts overdue
 * first and then by a priority that no page shows, so a task due in a week
 * would stand above one due in three hours. Ties keep the API's order.
 */
export function byDueTime(tasks: readonly WorkflowTask[]): WorkflowTask[] {
  return tasks
    .map((task, index) => ({ task, index, due: Date.parse(task.dueAt) }))
    .sort((a, b) => a.due - b.due || a.index - b.index)
    .map(({ task }) => task);
}

/**
 * The person's open tasks, earliest due first, and how many are past due. Two
 * small calls to the real tasks endpoint: the list, and a count of the late
 * ones so the figure is right even when the list is cut short. Needs you, My
 * timeline and the focus that follows a finished row all read this one order.
 */
export function useHomeTasks(enabled: boolean) {
  const list = useWorkflowsMyTasks(
    { pageSize: LOADED },
    { query: { enabled } },
  );
  const late = useWorkflowsMyTasks(
    { overdue: "true", pageSize: 1 },
    { query: { enabled } },
  );
  const loaded = list.data?.data;
  // Memoised on the answer: the array keeps its identity between renders.
  const tasks = useMemo(() => (loaded ? byDueTime(loaded) : NONE), [loaded]);
  return {
    list,
    /** False for a role with no inbox: nothing was asked, so nothing is pending. */
    enabled,
    tasks,
    total: list.data?.meta.total ?? 0,
    late: late.data?.meta.total ?? 0,
  };
}
