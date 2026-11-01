import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import type { ItemDetail } from "@orderpilot/shared";
import { SectionCard, StatusBadge } from "@/components/common";
import { formatDay, formatQuantity } from "@/lib/format";
import { RecordTable, type RecordColumn } from "./RecordTable";

type OrderLine = ItemDetail["orderLines"][number];

/**
 * A short line says where it stands: held out while its SPR waits, or covered
 * by the purchase order the approved SPR raised, which is on its way or in.
 */
function Note({ line }: { line: OrderLine }) {
  const { t } = useTranslation("master-data");
  const { shortfall } = line;
  if (!shortfall) return null;
  if (line.heldOut) {
    return <StatusBadge tone="warning">{t("item.orders.heldOut")}</StatusBadge>;
  }
  const figures = {
    ordered: formatQuantity(shortfall.ordered),
    available: formatQuantity(shortfall.availableStock),
    shortBy: formatQuantity(shortfall.shortBy),
    po: shortfall.purchaseOrderNo ?? "",
  };
  const received = shortfall.purchaseOrderStatus === "received";
  return (
    <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
      <StatusBadge tone={received ? "success" : "info"}>
        {t(received ? "item.orders.received" : "item.orders.onOrder", figures)}
      </StatusBadge>
      <span className="text-muted-foreground">
        {t(
          received ? "item.orders.coveredReceived" : "item.orders.covered",
          figures,
        )}
      </span>
    </span>
  );
}

/**
 * The open orders holding this item, and how they make up Qty. on Sales
 * Order. The sum is spelt out under the table: the counted lines are Qty. on
 * Sales Order, and any short line held out of it is the demand under review.
 */
export function ItemOrders({ item }: { item: ItemDetail }) {
  const { t } = useTranslation("master-data");
  const { listed, heldOut } = item.salesOrderBreakdown;
  const columns: RecordColumn<OrderLine>[] = [
    {
      id: "order",
      header: t("item.orders.order"),
      cell: (line) => (
        <Link
          to={`/order-tracker/${line.orderNo}`}
          className="font-mono font-medium text-primary underline-offset-4 hover:underline"
        >
          {line.orderNo}
        </Link>
      ),
    },
    {
      id: "customer",
      header: t("item.orders.customer"),
      cell: (line) => (
        <Link
          to={`/master-data/customers/${line.customerNo}`}
          className="underline-offset-4 hover:underline"
        >
          {line.customerName}
        </Link>
      ),
    },
    {
      id: "status",
      header: t("item.orders.status"),
      cell: (line) => <StatusBadge>{line.status}</StatusBadge>,
    },
    {
      id: "orderDate",
      header: t("item.orders.orderDate"),
      cell: (line) => formatDay(line.orderDate),
      kind: "date",
    },
    {
      id: "quantity",
      header: t("item.orders.quantity"),
      cell: (line) => formatQuantity(line.quantity),
      kind: "number",
    },
    {
      id: "note",
      header: t("item.orders.note"),
      cell: (line) => <Note line={line} />,
      wrap: true,
    },
  ];
  return (
    <SectionCard
      title={t("item.orders.title", { count: item.orderLines.length })}
      description={t("item.orders.description")}
    >
      <div id="item-orders" className="scroll-mt-s4 space-y-s2">
        <RecordTable
          caption={t("item.orders.caption")}
          columns={columns}
          rows={item.orderLines}
          rowKey={(line) => line.orderNo}
          emptyText={t("item.orders.empty")}
        />
        <dl className="grid grid-cols-[1fr_auto] gap-x-s3 gap-y-1 text-sm sm:grid-cols-[auto_auto] sm:justify-start">
          <dt className="text-muted-foreground">{t("item.orders.listed")}</dt>
          <dd data-numeric className="text-right tabular-nums">
            {formatQuantity(listed)}
          </dd>
          <dt className="font-medium">{t("item.stock.qtyOnSalesOrder")}</dt>
          <dd data-numeric className="text-right font-medium tabular-nums">
            {formatQuantity(item.qtyOnSalesOrder)}
          </dd>
          {Number(heldOut) > 0 ? (
            <>
              <dt className="text-muted-foreground">
                {t("item.orders.heldOutTotal")}
              </dt>
              <dd data-numeric className="text-right tabular-nums">
                {formatQuantity(heldOut)}
              </dd>
            </>
          ) : null}
        </dl>
      </div>
    </SectionCard>
  );
}
