import { useWorkflowsMyTasks } from "@/lib/api/generated/endpoints/workflows/workflows";

/** Most tasks the home screen reads at once: more than any role has open in the data set. */
const LOADED = 50;

/**
 * The person's open tasks, most urgent first, and how many are past due. Two
 * small calls to the real tasks endpoint: the list, and a count of the late
 * ones so the figure is right even when the list is cut short.
 */
export function useHomeTasks() {
  const list = useWorkflowsMyTasks({ pageSize: LOADED });
  const late = useWorkflowsMyTasks({ overdue: "true", pageSize: 1 });
  return {
    list,
    tasks: list.data?.data ?? [],
    total: list.data?.meta.total ?? 0,
    late: late.data?.meta.total ?? 0,
  };
}
