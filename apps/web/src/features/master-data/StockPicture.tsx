import { CircleAlert } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import type { ItemDetail } from "@orderpilot/shared";
import { SectionCard } from "@/components/common";
import { formatQuantity } from "@/lib/format";
import { cn } from "@/lib/utils";

function Figure({
  label,
  value,
  strong = false,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div className="min-w-0 space-y-0.5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p
        data-numeric
        className={cn(
          "text-2xl tabular-nums",
          strong ? "font-semibold" : "font-medium",
        )}
      >
        {formatQuantity(value)}
      </p>
    </div>
  );
}

function Sign({ children }: { children: string }) {
  return (
    <span
      aria-hidden="true"
      className="hidden self-end pb-0.5 text-xl text-muted-foreground sm:block"
    >
      {children}
    </span>
  );
}

/**
 * The stock as the sum it is, so that anyone can check the available figure
 * against the three it comes from. Orders that want more than that say so here.
 */
export function StockPicture({ item }: { item: ItemDetail }) {
  const { t } = useTranslation("master-data");
  const waiting = item.orderLines.filter(
    (line) => line.shortfall?.state === "waiting",
  );
  return (
    <SectionCard title={t("item.stock.title")}>
      <div className="grid grid-cols-2 gap-s2 sm:grid-cols-[1fr_auto_1fr_auto_1fr_auto_1fr]">
        <Figure label={t("item.stock.inventory")} value={item.inventory} />
        <Sign>-</Sign>
        <Figure
          label={t("item.stock.qtyOnSalesOrder")}
          value={item.qtyOnSalesOrder}
        />
        <Sign>+</Sign>
        <Figure
          label={t("item.stock.qtyOnPurchOrder")}
          value={item.qtyOnPurchOrder}
        />
        <Sign>=</Sign>
        <Figure
          label={t("item.stock.availableStock")}
          value={item.availableStock}
          strong
        />
      </div>
      <p className="measure mt-s2 text-sm text-muted-foreground">
        {t("item.stock.formula")}
      </p>
      {waiting.map((line) => (
        <p
          key={line.orderNo}
          className="mt-s1 flex items-start gap-2 text-sm font-medium text-destructive"
        >
          <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span>
            <Link
              to={`/order-tracker/${line.orderNo}`}
              className="underline underline-offset-4"
            >
              {line.orderNo}
            </Link>{" "}
            {t("item.stock.short", {
              ordered: formatQuantity(line.shortfall?.ordered ?? "0"),
              available: formatQuantity(line.shortfall?.availableStock ?? "0"),
              shortBy: formatQuantity(line.shortfall?.shortBy ?? "0"),
            })}
          </span>
        </p>
      ))}
    </SectionCard>
  );
}
