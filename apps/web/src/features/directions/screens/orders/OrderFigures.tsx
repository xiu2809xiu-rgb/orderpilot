import { Clock, FileQuestion, PackageMinus, TriangleAlert } from "lucide-react";
import { useTranslation } from "react-i18next";
import { formatQuantity } from "@/lib/format";
import { StatusChip } from "@/components/kit/StatusChip";
import { Amount } from "./Amount";
import { shortSentence } from "./stockText";
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

/**
 * What the order is short of: a chip with the quantity, and under it the first
 * item and how many more are short, in words a keyboard or a phone can read
 * (a tooltip alone would not reach them). The sentence in full is the
 * tooltip and the export.
 */
export function StockCell({ row }: { row: OrderRow }) {
  const { t } = useTranslation("directions-orders");
  const gap = row.shortage;
  if (!gap) {
    return <span className="text-muted-foreground">{t("cells.covered")}</span>;
  }
  return (
    <span className="od-stock" title={shortSentence(row, t)}>
      <StatusChip kind="warning" icon={PackageMinus}>
        {t("cells.short", { quantity: formatQuantity(gap.shortBy) })}
      </StatusChip>
      <span className="od-stock-item numeral fs-12 text-muted-foreground">
        {row.shortageCount > 1
          ? t("cells.shortItems", {
              itemNo: gap.itemNo,
              count: row.shortageCount - 1,
            })
          : gap.itemNo}
      </span>
    </span>
  );
}

/**
 * The documents column says only what the data says: a document waits for a
 * person to confirm it, or the order has open exceptions. The row carries the
 * count of its exceptions, not what each one is, so the chip says "open
 * exception": a late bill of lading and a packing list that differs from the
 * PO are both that, and "Differs" would be wrong for the first. The order
 * page lists each exception by name. Anything else is a dash, because nothing
 * here proves a document was checked.
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
        <StatusChip kind="destructive" icon={TriangleAlert}>
          {t("cells.exceptions", { count: row.openExceptions })}
        </StatusChip>
      ) : null}
    </span>
  );
}
