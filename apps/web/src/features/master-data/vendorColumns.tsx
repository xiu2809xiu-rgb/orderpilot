import type { TFunction } from "i18next";
import type { VendorDetail } from "@orderpilot/shared";
import { RecordLink, type MaskReason } from "@/components/common";
import { formatDay, formatQuantity } from "@/lib/format";
import { MaskedColumnHeader } from "./MaskedColumnHeader";
import { AvailableFigure, MaskedMoney, QuietDash } from "./pieces";
import type { RecordColumn } from "./RecordTable";
import { SprNumber } from "./SprNumber";
import { StockRule } from "./StockRule";

type PurchaseOrder = VendorDetail["openPurchaseOrders"][number];
type SuppliedItem = VendorDetail["items"][number];

/**
 * Most purchase orders were not raised from an SPR: a column empty on every
 * row says nothing, so `fromSprs` brings it in only when one was. A total the
 * role cannot read in any row is said once, in the header.
 */
export function purchaseOrderColumns(
  t: TFunction,
  fromSprs: boolean,
  totalReason: MaskReason | null,
): RecordColumn<PurchaseOrder>[] {
  return [
    {
      id: "no",
      header: t("vendor.orders.no"),
      cell: (po) => <span className="font-mono">{po.no}</span>,
    },
    ...(fromSprs
      ? [
          {
            id: "spr",
            header: t("vendor.orders.spr"),
            cell: (po: PurchaseOrder) => (
              <SprNumber recordNo={po.sprRecordNo} />
            ),
          },
        ]
      : []),
    {
      id: "orderDate",
      header: t("vendor.orders.orderDate"),
      cell: (po) => formatDay(po.orderDate),
      kind: "date",
    },
    {
      id: "expected",
      header: t("vendor.orders.expected"),
      cell: (po) => formatDay(po.expectedReceiptDate),
      kind: "date",
    },
    {
      id: "lines",
      header: t("vendor.orders.lines"),
      cell: (po) => po.lines,
      kind: "number",
    },
    {
      id: "quantity",
      header: t("vendor.orders.quantity"),
      cell: (po) => formatQuantity(po.outstandingQuantity),
      kind: "number",
    },
    {
      id: "total",
      header: t("vendor.orders.total"),
      headerContent: totalReason ? (
        <MaskedColumnHeader
          label={t("vendor.orders.total")}
          reason={totalReason}
        />
      ) : undefined,
      cell: (po) =>
        totalReason ? <QuietDash /> : <MaskedMoney field={po.total} />,
      kind: "money",
    },
  ];
}

export function suppliedItemColumns(
  t: TFunction,
): RecordColumn<SuppliedItem>[] {
  return [
    {
      id: "no",
      header: t("vendor.items.no"),
      cell: (item) => (
        <RecordLink
          to={`/master-data/items/${item.no}`}
          className="font-mono font-medium text-primary underline-offset-4 hover:underline"
        >
          {item.no}
        </RecordLink>
      ),
    },
    {
      id: "description",
      header: t("vendor.items.description"),
      cell: (item) => item.description,
    },
    {
      id: "vendorItemNo",
      header: t("vendor.items.vendorItemNo"),
      cell: (item) => <span className="font-mono">{item.vendorItemNo}</span>,
    },
    {
      id: "available",
      header: t("vendor.items.available"),
      // Short and Low show in this column, so their rule is in its head.
      headerContent: (
        <span className="inline-flex items-center gap-1">
          {t("vendor.items.available")}
          <StockRule />
        </span>
      ),
      cell: (item) => (
        <AvailableFigure
          value={item.availableStock}
          availability={item.availability}
        />
      ),
      kind: "number",
    },
  ];
}
