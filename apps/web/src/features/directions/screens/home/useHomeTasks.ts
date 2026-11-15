import { useWorkflowsMyTasks } from "@/lib/api/generated/endpoints/workflows/workflows";

/** Most tasks the home screen reads at once: more than any role has open in the data set. */
const LOADED = 50;

/**
 * The person's open tasks, most urgent first, and how many are past due. Two
 * small calls to the real tasks endpoint: the list, and a count of the late
 * ones so the figure is right even when the list is cut short.
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
  return {
    list,
    /** False for a role with no inbox: nothing was asked, so nothing is pending. */
    enabled,
    tasks: list.data?.data ?? [],
    total: list.data?.meta.total ?? 0,
    late: late.data?.meta.total ?? 0,
  };
}
