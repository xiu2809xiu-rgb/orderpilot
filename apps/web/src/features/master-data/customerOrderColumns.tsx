import type { TFunction } from "i18next";
import type { CustomerDetail } from "@orderpilot/shared";
import { RecordLink, StatusBadge, type MaskReason } from "@/components/common";
import { formatDay } from "@/lib/format";
import { MaskedColumnHeader } from "./MaskedColumnHeader";
import { MaskedMoney, QuietDash } from "./pieces";
import type { RecordColumn } from "./RecordTable";

type OpenOrder = CustomerDetail["openOrders"][number];
type OverdueOrder = CustomerDetail["overdueOrders"][number];

/** An order's number, linked to the order's own page. */
const orderLink = (orderNo: string) => (
  <RecordLink
    to={`/orders/${orderNo}`}
    className="font-mono font-medium text-primary underline-offset-4 hover:underline"
  >
    {orderNo}
  </RecordLink>
);

/** An amount the role cannot read in any row is said once, in the header. */
export function openOrderColumns(
  t: TFunction,
  amountReason: MaskReason | null,
): RecordColumn<OpenOrder>[] {
  return [
    {
      id: "order",
      header: t("customer.open.order"),
      cell: (order) => orderLink(order.orderNo),
    },
    {
      id: "po",
      header: t("customer.open.po"),
      cell: (order) => (
        <span className="font-mono">{order.externalDocumentNo}</span>
      ),
    },
    {
      id: "status",
      header: t("customer.open.status"),
      cell: (order) => <StatusBadge>{order.status}</StatusBadge>,
    },
    {
      id: "orderDate",
      header: t("customer.open.orderDate"),
      cell: (order) => formatDay(order.orderDate),
      kind: "date",
    },
    {
      id: "shipmentDate",
      header: t("customer.open.shipmentDate"),
      cell: (order) =>
        order.shipmentDate ? formatDay(order.shipmentDate) : "",
      kind: "date",
    },
    {
      id: "amount",
      header: t("customer.open.amount"),
      headerContent: amountReason ? (
        <MaskedColumnHeader
          label={t("customer.open.amount")}
          reason={amountReason}
        />
      ) : undefined,
      cell: (order) =>
        amountReason ? <QuietDash /> : <MaskedMoney field={order.amount} />,
      kind: "money",
    },
  ];
}

export function overdueOrderColumns(
  t: TFunction,
): RecordColumn<OverdueOrder>[] {
  return [
    {
      id: "order",
      header: t("customer.overdue.order"),
      cell: (order) => orderLink(order.orderNo),
    },
    {
      id: "po",
      header: t("customer.overdue.po"),
      cell: (order) => (
        <span className="font-mono">{order.externalDocumentNo}</span>
      ),
    },
    {
      id: "late",
      header: t("customer.overdue.late"),
      cell: (order) => (
        <StatusBadge tone="danger">
          {t("customer.overdue.days", { count: order.daysOverdue })}
        </StatusBadge>
      ),
    },
    {
      id: "reason",
      header: t("customer.overdue.reason"),
      cell: (order) =>
        t("customer.overdue.due", {
          step: order.step,
          date: formatDay(order.dueDate),
        }),
      wrap: true,
    },
  ];
}
