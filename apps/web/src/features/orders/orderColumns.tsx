import type { TFunction } from "i18next";
import type { SalesOrderRow } from "@orderpilot/shared";
import { RecordLink, type DataTableColumn } from "@/components/common";
import { Badge } from "@/components/ui/badge";
import { formatDay } from "@/lib/format";
import { CaptureChip } from "./CaptureChip";
import { OrderAmount } from "./OrderAmount";
import { ShortageLine } from "./ShortageLine";
import { shortageLabel } from "./shortageLabel";

/** A sample opens in the tracker. A stored order has no page until its own story. */
export const orderHref = (row: SalesOrderRow): string | undefined =>
  row.source === "sample" ? `/order-tracker/${row.orderNo}` : undefined;

function orderCell(row: SalesOrderRow, t: TFunction) {
  const href = orderHref(row);
  return (
    <span className="inline-flex items-center gap-2">
      {href ? (
        <RecordLink
          to={href}
          className="font-mono font-medium text-primary underline-offset-4 hover:underline"
        >
          {row.orderNo}
        </RecordLink>
      ) : (
        <span className="font-mono font-medium">{row.orderNo}</span>
      )}
      {row.source === "sample" ? (
        <Badge variant="outline">{t("sampleTag")}</Badge>
      ) : (
        // The Entry column is not in the phone summary, and a draft must not
        // pass for a submitted order. Wide screens have the column itself.
        <span className="md:hidden">
          <CaptureChip state={row.captureState} />
        </span>
      )}
    </span>
  );
}

/**
 * A phone shows the first three columns: the order, what it is short of and its
 * amount (or the dots that hide it). So those come first, and the customer,
 * who is on every wide screen, follows.
 *
 * The PO number and the order date start hidden under Columns: with the
 * sidebar open, the rest already fill a 1440 px screen, and a clipped column
 * is worse than a hidden one.
 *
 * The amount cannot sort for a role that cannot see prices: the server ignores
 * it, and sorting would leak the order of the hidden figures.
 */
export function orderColumns(
  t: TFunction,
  amountHidden: boolean,
): DataTableColumn<SalesOrderRow>[] {
  return [
    {
      id: "orderNo",
      header: t("columns.orderNo"),
      cell: (row) => orderCell(row, t),
      exportValue: (row) => row.orderNo,
      sortable: true,
      hideable: false,
    },
    {
      id: "stock",
      header: t("columns.stock"),
      cell: (row) => (
        <ShortageLine shortage={row.shortage} count={row.shortageCount} />
      ),
      exportValue: (row) =>
        row.shortage ? shortageLabel(row.shortage, row.shortageCount, t) : "",
    },
    {
      id: "amount",
      header: t("columns.amount"),
      cell: (row) => (
        <OrderAmount field={row.amount} currency={row.currencyCode} />
      ),
      // The screen shows the currency; a bare number in a file would not.
      exportValue: (row) =>
        row.amount.value === null
          ? t("hiddenAmount")
          : `${row.currencyCode} ${row.amount.value}`,
      kind: "money",
      sortable: !amountHidden,
    },
    {
      id: "customerNo",
      header: t("columns.customerNo"),
      cell: (row) => (
        <span className="inline-flex flex-wrap items-baseline gap-x-2">
          <span className="font-mono">{row.customerNo}</span>
          {row.customerName ? (
            <span className="text-muted-foreground">{row.customerName}</span>
          ) : null}
        </span>
      ),
      exportValue: (row) =>
        row.customerName
          ? `${row.customerNo} ${row.customerName}`
          : row.customerNo,
      sortable: true,
    },
    {
      id: "workflowStatus",
      header: t("columns.workflowStatus"),
      cell: (row) => row.workflowStatus ?? t("noStatus"),
      exportValue: (row) => row.workflowStatus ?? t("noStatus"),
    },
    {
      id: "captureState",
      header: t("columns.captureState"),
      cell: (row) => <CaptureChip state={row.captureState} />,
      exportValue: (row) =>
        row.captureState ? t(`captureStates.${row.captureState}`) : "",
      sortable: true,
    },
    {
      id: "externalDocumentNo",
      header: t("columns.externalDocumentNo"),
      cell: (row) => (
        <span className="font-mono">{row.externalDocumentNo}</span>
      ),
      exportValue: (row) => row.externalDocumentNo,
      defaultHidden: true,
    },
    {
      id: "orderDate",
      header: t("columns.orderDate"),
      cell: (row) => formatDay(row.orderDate),
      exportValue: (row) => row.orderDate,
      sortable: true,
      defaultHidden: true,
    },
    {
      id: "shipmentDate",
      header: t("columns.shipmentDate"),
      cell: (row) => (row.shipmentDate ? formatDay(row.shipmentDate) : ""),
      exportValue: (row) => row.shipmentDate ?? "",
      sortable: true,
      defaultHidden: true,
    },
  ];
}
