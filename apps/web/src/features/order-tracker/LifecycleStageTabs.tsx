import { ChevronDown } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useListCount } from "@/lib/useListCount";
import {
  groupStatusOf,
  LIFECYCLE_STAGES,
  singleStatusWithin,
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

/**
 * The active stage's dropdown: every status inside it, plus "Any status"
 * for the whole group. It sits below the filter chips, not inside the tabs,
 * since a `tablist` may only own `tab` elements. It only shows once a
 * stage's tab (not "All") is the one open, and its current pick is read
 * back from the `status` filter, so a link that opens the tracker on one
 * status still shows the right pick.
 */
export function StageStatusFilter({
  value,
  status,
  onSelectStatus,
}: {
  value: LifecycleStageTab;
  status: string | undefined;
  onSelectStatus: (status: string | undefined) => void;
}) {
  const { t } = useTranslation("order-tracker");
  const stage = LIFECYCLE_STAGES.find((candidate) => candidate.id === value);
  if (!stage) return null;
  const group = groupStatusOf(stage.id);
  const picked = singleStatusWithin(stage.id, status);
  const label = t(`list.stages.${stage.id}`);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={t("list.stages.statusMenu", { stage: label })}
          data-narrowed={picked ? "true" : undefined}
          className="inline-flex h-8 items-center gap-1 rounded-md px-2 text-sm text-muted-foreground hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none data-[narrowed=true]:text-foreground"
        >
          {t("list.stages.statusMenuLabel", {
            status: picked
              ? t(`list.statuses.${picked}`, { defaultValue: picked })
              : t("list.stages.anyStatus"),
          })}
          <ChevronDown className="size-3.5" aria-hidden="true" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuRadioGroup
          value={picked ?? group}
          onValueChange={onSelectStatus}
        >
          <DropdownMenuRadioItem value={group}>
            {t("list.stages.anyStatus")}
          </DropdownMenuRadioItem>
          <DropdownMenuSeparator />
          {stage.statuses.map((code) => (
            <DropdownMenuRadioItem key={code} value={code}>
              {t(`list.statuses.${code}`, { defaultValue: code })}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
