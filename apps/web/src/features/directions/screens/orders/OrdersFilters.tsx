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
import { MoreFilters } from "./MoreFilters";
import {
  fromStageStatus,
  stageStatusValue,
  type OrdersQuery,
} from "./ordersQuery";
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
  onChange,
}: {
  query: OrdersQuery;
  stageCounts: Record<string, number>;
  customers: readonly CustomerOption[];
  onChange: Patch;
}) {
  const { t } = useTranslation("directions-orders");
  const { t: tt } = useTranslation("order-tracker");
  const searchId = useId();
  const stageId = useId();
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
            className="od-control"
            onChange={(event) => {
              setDraft(event.target.value);
            }}
          />
        </span>
      </FilterField>
      <FilterField label={t("filters.stage")} htmlFor={stageId}>
        <Select
          value={stageStatusValue(query)}
          onValueChange={(value) => {
            onChange(fromStageStatus(value));
          }}
        >
          <SelectTrigger id={stageId} className="od-control w-60">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">
              {t("filters.allStages")} ({stageCounts.all ?? 0})
            </SelectItem>
            {LIFECYCLE_STAGES.map((stage) => (
              <SelectGroup key={stage.id}>
                <SelectSeparator />
                <SelectLabel>
                  {tt(`list.stages.${stage.id}`)} ({stageCounts[stage.id] ?? 0})
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
        <MoreFilters query={query} onChange={onChange} />
      </div>
    </div>
  );
}
