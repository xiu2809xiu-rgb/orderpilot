import { useAuditViewerList } from "@/lib/api/generated/endpoints/audit/audit";
import { useTrackerList } from "@/lib/api/generated/endpoints/tracker/tracker";
import { useWorkflowsOpenRules } from "@/lib/api/generated/endpoints/workflows/workflows";
import type { AddedBlock, HomeBlock } from "./homeAccess";

/** Rows each block lists before it points at the whole list. */
const ROWS = 5;

/**
 * The request behind each block of a role with no inbox, and behind the block
 * a role with an inbox gets besides "Needs you". All three are called, because
 * hooks cannot be conditional, but one is enabled exactly when its block is
 * drawn for the session, main or added, so a role asks the server for nothing
 * it does not show.
 */
export function useBlockQueries(block: HomeBlock, extra: AddedBlock | null) {
  const shown = (name: HomeBlock) => block === name || extra === name;
  const overdue = useTrackerList(
    { overdue: "true", sort: "amount", direction: "desc", pageSize: ROWS },
    { query: { enabled: shown("overdue") } },
  );
  const refused = useAuditViewerList(
    { refusalsOnly: "true", pageSize: ROWS },
    { query: { enabled: shown("refused") } },
  );
  const rules = useWorkflowsOpenRules({
    query: { enabled: shown("rules") },
  });
  return { overdue, refused, rules };
}
