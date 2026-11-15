import { useAuditViewerList } from "@/lib/api/generated/endpoints/audit/audit";
import { useTrackerList } from "@/lib/api/generated/endpoints/tracker/tracker";
import { useWorkflowsOpenRules } from "@/lib/api/generated/endpoints/workflows/workflows";
import type { HomeBlock } from "./homeAccess";

/** Rows each block lists before it points at the whole list. */
const ROWS = 5;

/**
 * The request behind the block of a role with no inbox. All three are called,
 * because hooks cannot be conditional, but only the role's own is enabled, so
 * a role asks the server for nothing that is not its own.
 */
export function useBlockQueries(block: HomeBlock) {
  const overdue = useTrackerList(
    { overdue: "true", sort: "amount", direction: "desc", pageSize: ROWS },
    { query: { enabled: block === "overdue" } },
  );
  const refused = useAuditViewerList(
    { refusalsOnly: "true", pageSize: ROWS },
    { query: { enabled: block === "refused" } },
  );
  const rules = useWorkflowsOpenRules({
    query: { enabled: block === "rules" },
  });
  return { overdue, refused, rules };
}
