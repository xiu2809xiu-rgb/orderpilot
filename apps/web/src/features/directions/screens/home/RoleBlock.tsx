import type { HomeBlock } from "./homeAccess";
import { OverdueBlock } from "./OverdueBlock";
import { RefusedBlock } from "./RefusedBlock";
import { RulesBlock } from "./RulesBlock";
import type { useBlockQueries } from "./useBlockQueries";

/** The one block of a role with no inbox, in the place of "Needs you". */
export function RoleBlock({
  block,
  queries,
}: {
  block: Exclude<HomeBlock, "tasks">;
  queries: ReturnType<typeof useBlockQueries>;
}) {
  if (block === "overdue") return <OverdueBlock query={queries.overdue} />;
  if (block === "refused") return <RefusedBlock query={queries.refused} />;
  return <RulesBlock query={queries.rules} />;
}
