import { SlidersHorizontal } from "lucide-react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

/**
 * The audit log's filters that matter less, behind the same button and popover
 * as the list pages' More filters (components/list-page/MoreFilters). That
 * shared one draws only selects, switches and date ranges; these are text
 * boxes that apply on Enter, so the popover is written here with its classes.
 */
export function AuditMoreFilters({
  applied,
  children,
}: {
  /** How many of the filters inside are in force, so a closed popover still tells. */
  applied: number;
  children: ReactNode;
}) {
  const { t } = useTranslation("list-page");
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="lp-more">
          <SlidersHorizontal aria-hidden="true" />
          {t("filters.more")}
          {applied > 0 ? (
            <span
              aria-label={t("filters.moreApplied", { count: applied })}
              className="lp-count"
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
        {children}
      </PopoverContent>
    </Popover>
  );
}
