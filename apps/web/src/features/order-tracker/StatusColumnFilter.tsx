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
import { cn } from "@/lib/utils";
import {
  groupStatusOf,
  LIFECYCLE_STAGES,
  singleStatusWithin,
  type LifecycleStageTab,
} from "./trackerParams";

/**
 * The Status column's own header: the label, a chevron, and (once a stage
 * tab, not "All", is open) a menu of that stage's statuses, with "Any
 * status in this stage" at the top. Replaces the old floating dropdown
 * above the search bar: the filter now lives where it acts, on the column
 * it filters. Disabled on the "All" tab, since there is then no one
 * stage's statuses to narrow.
 */
export function StatusColumnFilter({
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
  const picked = stage ? singleStatusWithin(stage.id, status) : undefined;
  const group = stage ? groupStatusOf(stage.id) : "";

  const trigger = (
    <button
      type="button"
      disabled={!stage}
      aria-label={t("list.columns.statusFilterLabel")}
      data-narrowed={picked ? "true" : undefined}
      className={cn(
        "-mx-1 inline-flex items-center gap-1 rounded-sm px-1 py-0.5 font-medium hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50 pointer-coarse:min-h-11",
      )}
    >
      {t("list.columns.status")}
      <ChevronDown
        className={cn(
          "size-3.5",
          picked ? "text-primary" : "text-muted-foreground",
        )}
        aria-hidden="true"
      />
      {picked ? (
        <span className="size-1.5 rounded-full bg-primary" aria-hidden="true" />
      ) : null}
    </button>
  );

  if (!stage) return trigger;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
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
