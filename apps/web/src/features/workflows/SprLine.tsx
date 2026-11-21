import type { TaskSpr } from "@orderpilot/shared";
import { useTranslation } from "react-i18next";
import { StatusBadge } from "@/components/common";
import { formatAmount, formatQuantity } from "./format";

/**
 * What an SPR would buy, flagged when the item has under a month of stock.
 * A task row and a reminder row both show it, so the two lists read the same.
 */
export function SprLine({ spr }: { spr: TaskSpr }) {
  const { t } = useTranslation("workflows");
  const cover = spr.monthsOfCover;
  return (
    <>
      <span className="text-foreground">
        {t("task.sprLine", {
          quantity: formatQuantity(spr.quantity),
          item: spr.itemDescription,
        })}
      </span>
      {cover !== null && Number(cover) < 1 ? (
        <StatusBadge tone="warning">{t("spr.lowCover")}</StatusBadge>
      ) : (
        <span>
          {cover === null
            ? t("spr.noSales")
            : t("task.cover", { months: formatAmount(cover) })}
        </span>
      )}
    </>
  );
}
