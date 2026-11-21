import { useTranslation } from "react-i18next";
import { formatDay } from "@/lib/format";
import type { CustomerOption } from "./CustomerFilter";
import { rangeReversed, type OrdersQuery } from "./ordersQuery";

export interface AppliedChip {
  id: string;
  label: string;
  clear: Partial<OrdersQuery>;
}

/**
 * The filters in force, in words, each with what clears it. The search and the
 * view are on screen already, so they are not here. The same words go on a
 * printout, which says what narrowed the list.
 */
export function useAppliedChips(
  query: OrdersQuery,
  customers: readonly CustomerOption[],
): AppliedChip[] {
  const { t } = useTranslation("directions-orders");
  const { t: tt } = useTranslation("order-tracker");
  const chips: AppliedChip[] = [];
  const customer = customers.find((option) => option.no === query.customer);
  if (query.customer) {
    chips.push({
      id: "customer",
      label: t("applied.customer", { value: customer?.name ?? query.customer }),
      clear: { customer: null },
    });
  }
  if (query.status) {
    const codes = query.status.split(",");
    chips.push({
      id: "status",
      label: t("applied.status", {
        value:
          codes.length === 1
            ? tt(`list.statuses.${codes[0] ?? ""}`, { defaultValue: codes[0] })
            : t("applied.several", { count: codes.length }),
      }),
      clear: { status: null, stage: "all" },
    });
  } else if (query.stage !== "all") {
    chips.push({
      id: "stage",
      label: t("applied.stage", { value: tt(`list.stages.${query.stage}`) }),
      clear: { stage: "all" },
    });
  }
  if (query.step) {
    chips.push({
      id: "step",
      label: t("applied.step", {
        value: t(`journey.sales.${query.step}`, {
          ns: "directions-parts",
          defaultValue: query.step,
        }),
      }),
      clear: { step: null },
    });
  }
  const flags: [boolean, string, keyof OrdersQuery][] = [
    [query.overdue, "filters.overdue", "overdue"],
    [query.exceptions, "filters.exceptions", "exceptions"],
    [query.stock, "filters.stock", "stock"],
    [query.toConfirm, "filters.toConfirm", "toConfirm"],
    [query.open, "filters.open", "open"],
  ];
  for (const [on, key, field] of flags) {
    if (on) chips.push({ id: field, label: t(key), clear: { [field]: false } });
  }
  if (query.entry) {
    chips.push({
      id: "entry",
      label: t("applied.entry", { value: t(`entry.${query.entry}`) }),
      clear: { entry: null },
    });
  }
  if (query.source) {
    chips.push({
      id: "source",
      label: t("applied.source", { value: t(`source.${query.source}`) }),
      clear: { source: null },
    });
  }
  // A reversed range filters nothing, so it is not "in force".
  if ((query.from ?? query.to) && !rangeReversed(query)) {
    chips.push({
      id: "date",
      label: t("applied.dates", {
        from: query.from ? formatDay(query.from) : t("applied.open"),
        to: query.to ? formatDay(query.to) : t("applied.open"),
      }),
      clear: { from: null, to: null },
    });
  }
  return chips;
}
