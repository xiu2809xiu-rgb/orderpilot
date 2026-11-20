import { useWorkflowsOrderFlow } from "@/lib/api/generated/endpoints/workflows/workflows";
import { hasPermission, useSessionStore } from "@/stores/session";

/**
 * Area 2's record of the order: its steps, its timeline and its documents.
 * Only a role that may read the workflow asks, and only for an order the
 * workflow knows (not a draft or a void one). A refusal or a miss is not an
 * error here: the page simply has no latest act and no workflow documents, so
 * there is no retry. The page and the Documents tab both use this, so the
 * request is made once, and a finished task (which asks every query again)
 * brings the new entry to the page without a reload.
 */
export function useOrderFlow(orderNo: string, inWorkflow: boolean) {
  const mayRead = hasPermission(
    useSessionStore((state) => state.session),
    "workflows.read",
  );
  return useWorkflowsOrderFlow(orderNo, {
    query: { enabled: mayRead && inWorkflow, retry: false },
  });
}
