import {
  ORDER_CAPTURE_STATES,
  ORDER_SOURCES,
  type OrderCaptureState,
  type OrderSource,
} from "@orderpilot/shared";
import { SlidersHorizontal, TriangleAlert } from "lucide-react";
import { useId } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { DateRangeField } from "./DateRangeField";
import { rangeReversed, type OrdersQuery } from "./ordersQuery";
import { RadioChoice } from "./RadioChoice";

type Patch = (patch: Partial<OrdersQuery>) => void;

/** How many of the filters behind the button are on, so a closed button still tells. */
export function moreCount(query: OrdersQuery): number {
  return [
    query.stock,
    query.toConfirm,
    query.open,
    query.entry,
    query.source,
    // A reversed range filters nothing, so it does not count as on.
    (query.from ?? query.to) && !rangeReversed(query),
  ].filter(Boolean).length;
}

/** The filters kept behind "More filters": stock, documents, open orders, entry, source and the date range. */
export function MoreFilters({
  query,
  onChange,
}: {
  query: OrdersQuery;
  onChange: Patch;
}) {
  const { t } = useTranslation("directions-orders");
  const id = useId();
  const count = moreCount(query);
  // A reversed range is ignored, yet the address still holds both dates: with
  // the panel closed nothing else would say why the list is not narrowed.
  const reversed = rangeReversed(query);
  const warningId = `${id}-dates`;
  const toggle = (key: "stock" | "toConfirm" | "open", label: string) => (
    <div className="flex min-h-9 items-center justify-between gap-4 pointer-coarse:min-h-11">
      {/* The label fills the row, so on a touch screen the whole row is the target. */}
      <Label
        htmlFor={`${id}-${key}`}
        className="fs-14 flex flex-1 items-center self-stretch font-normal"
      >
        {label}
      </Label>
      <Switch
        id={`${id}-${key}`}
        checked={query[key]}
        onCheckedChange={(checked) => {
          onChange({ [key]: checked });
        }}
      />
    </div>
  );
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className="od-control"
            aria-describedby={reversed ? warningId : undefined}
          >
            <SlidersHorizontal aria-hidden="true" />
            {t("filters.more")}
            {count > 0 ? (
              <span
                className="numeral od-count"
                aria-label={t("filters.moreOn", { count })}
              >
                {count}
              </span>
            ) : null}
          </Button>
        </PopoverTrigger>
        {/* Radix measures the room under the button: the panel scrolls inside itself rather than run off a short window. */}
        <PopoverContent
          align="start"
          collisionPadding={12}
          className="w-80 max-h-(--radix-popover-content-available-height) space-y-3 overflow-y-auto"
        >
          <div>
            {toggle("stock", t("filters.stock"))}
            {toggle("toConfirm", t("filters.toConfirm"))}
            {toggle("open", t("filters.open"))}
          </div>
          <RadioChoice<OrderCaptureState>
            legend={t("filters.entry")}
            anyLabel={t("filters.any")}
            value={query.entry}
            options={ORDER_CAPTURE_STATES.map((state) => ({
              value: state,
              label: t(`entry.${state}`),
            }))}
            onChange={(entry) => {
              onChange({ entry });
            }}
          />
          <RadioChoice<OrderSource>
            legend={t("filters.source")}
            anyLabel={t("filters.any")}
            value={query.source}
            options={ORDER_SOURCES.map((source) => ({
              value: source,
              label: t(`source.${source}`),
            }))}
            onChange={(source) => {
              onChange({ source });
            }}
          />
          <DateRangeField from={query.from} to={query.to} onChange={onChange} />
        </PopoverContent>
      </Popover>
      {reversed ? (
        <span
          id={warningId}
          className="od-range-error fs-12 inline-flex items-center gap-1"
        >
          <TriangleAlert aria-hidden="true" className="size-3.5 shrink-0" />
          {t("filters.datesNotInOrder")}
        </span>
      ) : null}
    </span>
  );
}
