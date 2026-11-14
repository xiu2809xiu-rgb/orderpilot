import type { TFunction } from "i18next";
import type { HomeBlock } from "./homeAccess";
import type { useBlockQueries } from "./useBlockQueries";
import type { useHomeTasks } from "./useHomeTasks";

/**
 * The line under the greeting: how much waits for this role, in the words of
 * its own list. Nothing while the number is still on its way, and nothing
 * when the request failed, because the section says that itself.
 */
export function introOf(
  block: HomeBlock,
  home: ReturnType<typeof useHomeTasks>,
  queries: ReturnType<typeof useBlockQueries>,
  t: TFunction<"directions-home">,
): string | undefined {
  if (block === "tasks") {
    if (home.list.isPending || home.list.isError) return undefined;
    return home.total === 0
      ? t("introNone")
      : t("intro", { count: home.total, late: home.late });
  }
  if (block === "overdue") {
    const total = queries.overdue.data?.meta.total;
    if (total === undefined) return undefined;
    return total === 0
      ? t("introOverdueNone")
      : t("introOverdue", { count: total });
  }
  if (block === "refused") {
    const total = queries.refused.data?.meta.total;
    if (total === undefined) return undefined;
    return total === 0
      ? t("introRefusedNone")
      : t("introRefused", { count: total });
  }
  // A rule Spectra settled at the briefing no longer waits for it.
  const total = queries.rules.data?.data.filter(
    (rule) => rule.status === "open",
  ).length;
  if (total === undefined) return undefined;
  return total === 0 ? t("introRulesNone") : t("introRules", { count: total });
}
