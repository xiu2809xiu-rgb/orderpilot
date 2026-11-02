import { SlidersHorizontal } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { TableFilters } from "@/components/common";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { FilterControl } from "./FilterControl";
import type { ListFilter } from "./types";

interface MoreFiltersProps {
  filters: readonly ListFilter[];
  values: TableFilters;
  setFilter: (id: string, value: string | boolean | undefined) => void;
}

/**
 * The filters that matter less, in a popover. It is as wide as the screen
 * allows (390 px phones included) and scrolls inside itself when it is tall.
 */
export function MoreFilters({ filters, values, setFilter }: MoreFiltersProps) {
  const { t } = useTranslation("list-page");
  if (filters.length === 0) return null;
  const applied = filters.filter((filter) => {
    const value = values[filter.id];
    return value !== undefined && value !== false && value !== "";
  }).length;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="pointer-coarse:h-11">
          <SlidersHorizontal aria-hidden="true" />
          {t("filters.more")}
          {applied > 0 ? (
            <span
              aria-label={t("filters.moreApplied", { count: applied })}
              className="rounded-full bg-primary px-1.5 text-xs text-primary-foreground tabular-nums"
            >
              {applied}
            </span>
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        collisionPadding={16}
        className="max-h-[min(28rem,calc(100dvh-8rem))] w-[min(22rem,calc(100vw-2rem))] space-y-s2 overflow-y-auto"
      >
        <p className="text-sm font-medium">{t("filters.moreTitle")}</p>
        {filters.map((filter) => (
          <FilterControl
            key={filter.id}
            filter={filter}
            filters={values}
            setFilter={setFilter}
            showLabel
          />
        ))}
      </PopoverContent>
    </Popover>
  );
}
