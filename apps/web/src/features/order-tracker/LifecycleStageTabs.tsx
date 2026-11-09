import { useTranslation } from "react-i18next";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useListCount } from "@/lib/useListCount";
import {
  groupStatusOf,
  LIFECYCLE_STAGES,
  type LifecycleStageId,
  type LifecycleStageTab,
} from "./trackerParams";

/**
 * One stage's count, its own request at `pageSize=1`: the pattern the role
 * home tiles already use (`useListCount`). It ignores every other active
 * filter (search, overdue), so a stage's count never disagrees with what its
 * own tab opens.
 */
function StageCount({ status }: { status?: string }) {
  const api = status ? `/tracker/orders?status=${status}` : "/tracker/orders";
  const count = useListCount(api);
  if (count.isPending) return <>…</>;
  if (count.isError) return <>–</>;
  return <>{count.data.toLocaleString("en")}</>;
}

/**
 * The tracker's top tabs: All and the five lifecycle stages, each with its
 * count, so staff can group orders by stage instead of scanning one flat
 * list. Clicking a stage's tab filters to every status in it. The active
 * tab is read back from the `status` filter, so a link that opens the
 * tracker on one status still lands on the right tab.
 */
export function LifecycleStageTabs({
  value,
  onSelectStatus,
}: {
  value: LifecycleStageTab;
  onSelectStatus: (status: string | undefined) => void;
}) {
  const { t } = useTranslation("order-tracker");
  return (
    <Tabs
      value={value}
      onValueChange={(next) => {
        onSelectStatus(
          next === "all" ? undefined : groupStatusOf(next as LifecycleStageId),
        );
      }}
    >
      <TabsList aria-label={t("list.stages.label")}>
        {/* No `TabsContent` exists (the table below is shared by every tab),
            so the trigger's auto `aria-controls` would point nowhere: drop
            it. */}
        <TabsTrigger value="all" aria-controls={undefined}>
          {t("list.stages.all")} (<StageCount />)
        </TabsTrigger>
        {LIFECYCLE_STAGES.map((stage) => (
          <TabsTrigger
            key={stage.id}
            value={stage.id}
            aria-controls={undefined}
          >
            {t(`list.stages.${stage.id}`)} (
            <StageCount status={groupStatusOf(stage.id)} />)
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}
