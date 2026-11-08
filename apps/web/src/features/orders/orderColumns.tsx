import type { TFunction } from "i18next";
import type { SalesOrderRow } from "@orderpilot/shared";
import { RecordLink, type DataTableColumn } from "@/components/common";
import { Badge } from "@/components/ui/badge";
import { formatDay } from "@/lib/format";
import { CaptureChip } from "./CaptureChip";
import { OrderAmount } from "./OrderAmount";
import { ShortageLine } from "./ShortageLine";

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
      ) : null}
    </span>
  );
}

function shortageText(row: SalesOrderRow, t: TFunction): string {
  if (!row.shortage) return "";
  return t("shortage.line", {
    quantity: row.shortage.shortBy,
    itemNo: row.shortage.itemNo,
  });
}

/**
 * Order, customer and status come first, so a phone shows those three. The
 * amount cannot sort for a role that cannot see prices: the server ignores it,
 * and sorting would leak the order of the hidden figures.
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
      id: "customerNo",
      header: t("columns.customerNo"),
      cell: (row) => <span className="font-mono">{row.customerNo}</span>,
      exportValue: (row) => row.customerNo,
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
    },
    {
      id: "orderDate",
      header: t("columns.orderDate"),
      cell: (row) => formatDay(row.orderDate),
      exportValue: (row) => row.orderDate,
      sortable: true,
    },
    {
      id: "shipmentDate",
      header: t("columns.shipmentDate"),
      cell: (row) => (row.shipmentDate ? formatDay(row.shipmentDate) : ""),
      exportValue: (row) => row.shipmentDate ?? "",
      sortable: true,
      defaultHidden: true,
    },
    {
      id: "amount",
      header: t("columns.amount"),
      cell: (row) => (
        <OrderAmount field={row.amount} currency={row.currencyCode} />
      ),
      exportValue: (row) => row.amount.value ?? t("hiddenAmount"),
      kind: "money",
      sortable: !amountHidden,
    },
    {
      id: "stock",
      header: t("columns.stock"),
      cell: (row) => (
        <ShortageLine shortage={row.shortage} count={row.shortageCount} />
      ),
      exportValue: (row) => shortageText(row, t),
    },
  ];
}
