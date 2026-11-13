import { Clock, FileQuestion, PackageMinus, TriangleAlert } from "lucide-react";
import { useTranslation } from "react-i18next";
import { formatQuantity } from "@/lib/format";
import { StatusChip } from "../../kit/StatusChip";
import { Amount } from "./Amount";
import { ageInDays, type OrderRow } from "./orderRow";

/** How old the order is in days, with a chip when the tracker says it is past due. */
export function AgeCell({ row, today }: { row: OrderRow; today: string }) {
  const { t } = useTranslation("directions-orders");
  const days = ageInDays(row.orderDate, today);
  const late = row.overdue?.overdue === true ? row.overdue : null;
  return (
    <span className="od-age">
      <span className="numeral">{t("cells.days", { count: days })}</span>
      {late ? (
        <StatusChip kind="destructive" icon={Clock}>
          {t("cells.late", { count: late.daysOverdue })}
        </StatusChip>
      ) : null}
    </span>
  );
}

/** The order's value in its currency, or a mask with the reason the role may not see it. */
export function ValueCell({ row }: { row: OrderRow }) {
  return <Amount field={row.amount} currency={row.currencyCode} />;
}

/** What the order is short of, as one chip: the quantity, and the item in the tooltip text. */
export function StockCell({ row }: { row: OrderRow }) {
  const { t } = useTranslation("directions-orders");
  const gap = row.shortage;
  if (!gap) {
    return <span className="text-muted-foreground">{t("cells.covered")}</span>;
  }
  const quantity = formatQuantity(gap.shortBy);
  return (
    <span
      title={
        row.shortageCount > 1
          ? t("cells.shortLineMore", {
              quantity,
              itemNo: gap.itemNo,
              count: row.shortageCount - 1,
            })
          : t("cells.shortLine", { quantity, itemNo: gap.itemNo })
      }
    >
      <StatusChip kind="warning" icon={PackageMinus}>
        {t("cells.short", { quantity })}
      </StatusChip>
    </span>
  );
}

/**
 * The documents column says only what the data says: a document waits for a
 * person to confirm it, or a check found a difference. Anything else is a
 * dash, because nothing here proves a document was checked.
 */
export function DocsCell({ row }: { row: OrderRow }) {
  const { t } = useTranslation("directions-orders");
  if (!row.toConfirm && row.openExceptions === 0) {
    return (
      <span className="text-muted-foreground">
        <span aria-hidden="true">-</span>
        <span className="sr-only">{t("cells.docsNone")}</span>
      </span>
    );
  }
  return (
    <span className="od-docs-cell">
      {row.toConfirm ? (
        <StatusChip kind="info" icon={FileQuestion}>
          {t("cells.toConfirm")}
        </StatusChip>
      ) : null}
      {row.openExceptions > 0 ? (
        <span title={t("cells.differsCount", { count: row.openExceptions })}>
          <StatusChip kind="destructive" icon={TriangleAlert}>
            {t("cells.differs")}
          </StatusChip>
        </span>
      ) : null}
    </span>
  );
}
