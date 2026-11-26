import { ListChecks } from "lucide-react";
import { useTranslation } from "react-i18next";
import { CountBadge } from "@/components/common/CountBadge";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  statusCodes,
  statusesOfStage,
  toggleStatus,
  type OrdersQuery,
} from "./ordersQuery";
import { ToggleChip } from "./ToggleChip";

/**
 * Several statuses at once: one chip for each status the lifecycle has, in its
 * order. Each press adds or takes off that status, and the address keeps them
 * as a comma list, which the Stage and status list still reads (a whole stage
 * is still one choice there). The count says how many are on.
 */
export function StatusFilter({
  query,
  onChange,
}: {
  query: OrdersQuery;
  onChange: (patch: Partial<OrdersQuery>) => void;
}) {
  const { t } = useTranslation("directions-orders");
  const { t: tt } = useTranslation("order-tracker");
  const chosen = statusCodes(query.status);
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" className="od-control">
          <ListChecks aria-hidden="true" />
          {t("filters.statuses")}
          <CountBadge
            count={chosen.length}
            className="numeral od-count"
            label={t("filters.statusesOn", { count: chosen.length })}
          />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        collisionPadding={12}
        className="w-96 max-w-(--radix-popover-content-available-width) max-h-(--radix-popover-content-available-height) overflow-y-auto"
      >
        <fieldset className="space-y-2">
          <legend className="fs-14 font-medium">
            {t("filters.statusesLegend")}
          </legend>
          <div className="od-status-chips">
            {statusesOfStage("all").map((code) => (
              <ToggleChip
                key={code}
                pressed={chosen.includes(code)}
                onPressedChange={() => {
                  onChange(toggleStatus(query.status, code));
                }}
              >
                {tt(`list.statuses.${code}`, { defaultValue: code })}
              </ToggleChip>
            ))}
          </div>
        </fieldset>
      </PopoverContent>
    </Popover>
  );
}
