import { Search } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LIFECYCLE_STAGES } from "@/features/order-tracker/trackerParams";
import { CustomerFilter, type CustomerOption } from "./CustomerFilter";
import { FilterField } from "./FilterField";
import { FilterPanel } from "./FilterPanel";
import { MoreFilters } from "./MoreFilters";
import {
  fromStageStatus,
  stageStatusValue,
  type OrdersQuery,
} from "./ordersQuery";
import { StatusFilter } from "./StatusFilter";
import { ToggleChip } from "./ToggleChip";

type Patch = (patch: Partial<OrdersQuery>) => void;

/**
 * The filters of the two old pages in one bar: search, stage and status in one
 * list (the tracker's tabs and its column menu), customer, past due and exceptions
 * (its two switches), and the rest of the Orders list's filters under More
 * filters. Every control has its label in view.
 */
export function OrdersFilters({
  query,
  stageCounts,
  customers,
  active,
  onChange,
}: {
  query: OrdersQuery;
  /** Null while the list has not answered: the stages then show no count. */
  stageCounts: Record<string, number> | null;
  customers: readonly CustomerOption[];
  /** How many filters are in force, for the phone's closed panel. */
  active: number;
  onChange: Patch;
}) {
  const { t } = useTranslation("directions-orders");
  const { t: tt } = useTranslation("order-tracker");
  const searchId = useId();
  const stageId = useId();
  const countOf = (id: string) =>
    stageCounts ? ` (${String(stageCounts[id] ?? 0)})` : "";
  // What is typed shows at once; the list follows a moment after the last key,
  // so typing is never behind the router. A change from elsewhere (Clear all, a
  // saved view) replaces what is typed.
  const [draft, setDraft] = useState(query.search);
  const pushed = useRef(query.search);
  useEffect(() => {
    if (query.search !== pushed.current) {
      pushed.current = query.search;
      setDraft(query.search);
    }
  }, [query.search]);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (draft !== pushed.current) {
        pushed.current = draft;
        onChange({ search: draft });
      }
    }, 250);
    return () => {
      window.clearTimeout(timer);
    };
  }, [draft, onChange]);
  return (
    <div className="od-filters">
      <FilterField
        label={t("filters.search")}
        htmlFor={searchId}
        className="od-field-search"
      >
        <span className="od-search">
          <Search aria-hidden="true" />
          <Input
            id={searchId}
            type="search"
            value={draft}
            placeholder={t("filters.searchHint")}
            // The slash key finds this field (see app/shell/shortcuts.ts).
            data-quick-search=""
            aria-keyshortcuts="/"
            className="od-control"
            onChange={(event) => {
              setDraft(event.target.value);
            }}
          />
        </span>
      </FilterField>
      <FilterPanel active={active}>
        <FilterField label={t("filters.stage")} htmlFor={stageId}>
          <Select
            value={stageStatusValue(query)}
            onValueChange={(value) => {
              onChange(fromStageStatus(value));
            }}
          >
            <SelectTrigger id={stageId} className="od-control w-60">
              <SelectValue placeholder={t("filters.severalStatuses")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">
                {t("filters.allStages")}
                {countOf("all")}
              </SelectItem>
              {LIFECYCLE_STAGES.map((stage) => (
                <SelectGroup key={stage.id}>
                  <SelectSeparator />
                  <SelectLabel>
                    {tt(`list.stages.${stage.id}`)}
                    {countOf(stage.id)}
                  </SelectLabel>
                  <SelectItem value={`stage:${stage.id}`}>
                    {t("filters.wholeStage", {
                      stage: tt(`list.stages.${stage.id}`),
                    })}
                  </SelectItem>
                  {stage.statuses.map((code) => (
                    <SelectItem key={code} value={`status:${code}`}>
                      {tt(`list.statuses.${code}`, { defaultValue: code })}
                    </SelectItem>
                  ))}
                </SelectGroup>
              ))}
            </SelectContent>
          </Select>
        </FilterField>
        <CustomerFilter
          options={customers}
          value={query.customer}
          onChange={(customer) => {
            onChange({ customer });
          }}
        />
        <div className="od-toggles">
          <ToggleChip
            pressed={query.overdue}
            onPressedChange={(overdue) => {
              onChange({ overdue });
            }}
          >
            {t("filters.overdue")}
          </ToggleChip>
          <ToggleChip
            pressed={query.exceptions}
            onPressedChange={(exceptions) => {
              onChange({ exceptions });
            }}
          >
            {t("filters.exceptions")}
          </ToggleChip>
          <StatusFilter query={query} onChange={onChange} />
          <MoreFilters query={query} onChange={onChange} />
        </div>
      </FilterPanel>
    </div>
  );
}
