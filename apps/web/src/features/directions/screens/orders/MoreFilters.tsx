import {
  ORDER_CAPTURE_STATES,
  ORDER_SOURCES,
  type OrderCaptureState,
  type OrderSource,
} from "@orderpilot/shared";
import { SlidersHorizontal } from "lucide-react";
import { useId } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import type { OrdersQuery } from "./ordersQuery";
import { RadioChoice } from "./RadioChoice";

type Patch = (patch: Partial<OrdersQuery>) => void;

/** How many of the filters behind the button are on, so a closed button still tells. */
export function moreCount(query: OrdersQuery): number {
  return [
    query.toConfirm,
    query.open,
    query.entry,
    query.source,
    query.from ?? query.to,
  ].filter(Boolean).length;
}

const DAY_MS = 86_400_000;
const spanDays = (from: string | null, to: string | null): number | null =>
  from && to
    ? Math.round((Date.parse(to) - Date.parse(from)) / DAY_MS) + 1
    : null;

/** The filters kept behind "More filters": documents, open orders, entry, source and the date range. */
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
  const span = spanDays(query.from, query.to);
  const toggle = (key: "toConfirm" | "open", label: string) => (
    <div className="flex min-h-9 items-center justify-between gap-4">
      <Label htmlFor={`${id}-${key}`} className="fs-14 font-normal">
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
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" className="od-control">
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
      <PopoverContent align="start" className="w-80 space-y-4">
        <div>
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
        <fieldset className="space-y-2">
          <legend className="fs-14 font-medium">
            {t("filters.orderDate")}
          </legend>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label
                htmlFor={`${id}-from`}
                className="fs-12 text-muted-foreground"
              >
                {t("filters.from")}
              </Label>
              <Input
                id={`${id}-from`}
                type="date"
                value={query.from ?? ""}
                max={query.to ?? undefined}
                onChange={(event) => {
                  onChange({ from: event.target.value || null });
                }}
              />
            </div>
            <div className="space-y-1">
              <Label
                htmlFor={`${id}-to`}
                className="fs-12 text-muted-foreground"
              >
                {t("filters.to")}
              </Label>
              <Input
                id={`${id}-to`}
                type="date"
                value={query.to ?? ""}
                min={query.from ?? undefined}
                onChange={(event) => {
                  onChange({ to: event.target.value || null });
                }}
              />
            </div>
          </div>
          {span !== null ? (
            <p className="od-span fs-14">
              {t("filters.span", { count: span })}
            </p>
          ) : null}
        </fieldset>
      </PopoverContent>
    </Popover>
  );
}
