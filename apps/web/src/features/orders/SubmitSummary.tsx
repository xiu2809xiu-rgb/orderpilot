import type { SalesOrderDetail } from "@orderpilot/shared";
import { useTranslation } from "react-i18next";
import { formatMoney, formatQuantity } from "@/lib/format";
import { SubmitWarning } from "./SubmitWarning";

/** What the line says: its words, or the item's number when the line has none. */
function itemOf(record: SalesOrderDetail, itemNo: string): string {
  const words = record.lines.find(
    (line) => line.itemNo === itemNo,
  )?.description;
  return words === undefined || words === "" ? itemNo : words;
}

/**
 * What is being submitted, from the record that is saved: the customer, the PO
 * and the lines, and the total and prepayment when the role may see prices
 * (the server hides the figure from a role that may not, and the dialog then
 * leaves it out). Two things that are true but do not stop a submit are warned
 * about: a total of nothing, and stock that is short today.
 */
export function SubmitSummary({ record }: { record: SalesOrderDetail }) {
  const { t } = useTranslation("orders");
  const { amount, shortage } = record;
  const total = !amount.masked ? amount.value : null;
  const gap = shortage
    ? {
        item: itemOf(record, shortage.itemNo),
        quantity: formatQuantity(shortage.shortBy),
      }
    : null;
  return (
    <div className="min-w-0 space-y-s1 text-sm">
      <p className="min-w-0 break-words">
        {t("form.submit.summary", {
          count: record.lines.length,
          customerNo: record.customerNo,
          po: record.externalDocumentNo,
        })}
      </p>
      {total !== null ? (
        <p className="numeral text-muted-foreground">
          {t("form.submit.totals", {
            total: formatMoney(total, record.currencyCode),
            percent: Number(record.prepaymentPercent),
          })}
        </p>
      ) : null}
      {total !== null && Number(total) === 0 ? (
        <SubmitWarning>{t("form.submit.zeroTotal")}</SubmitWarning>
      ) : null}
      {gap ? (
        <SubmitWarning>
          {record.shortageCount > 1
            ? t("form.submit.shortMore", {
                ...gap,
                count: record.shortageCount - 1,
              })
            : t("form.submit.short", gap)}
        </SubmitWarning>
      ) : null}
    </div>
  );
}
