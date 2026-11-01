import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import type { ItemDetail } from "@orderpilot/shared";
import { SectionCard, StatusBadge } from "@/components/common";
import { formatDay, formatQuantity } from "@/lib/format";
import { RecordTable, type RecordColumn } from "./RecordTable";

type OrderLine = ItemDetail["orderLines"][number];

function Note({ line }: { line: OrderLine }) {
  const { t } = useTranslation("master-data");
  if (!line.heldOut) return null;
  const figures = {
    ordered: formatQuantity(line.shortfall?.ordered ?? "0"),
    available: formatQuantity(line.shortfall?.availableStock ?? "0"),
    shortBy: formatQuantity(line.shortfall?.shortBy ?? "0"),
    po: line.shortfall?.purchaseOrderNo ?? "",
  };
  return (
    <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
      <StatusBadge tone="warning">{t("item.orders.heldOut")}</StatusBadge>
      {line.shortfall?.state === "covered" ? (
        <span className="text-muted-foreground">
          {t("item.orders.covered", figures)}
        </span>
      ) : null}
    </span>
  );
}

/**
 * The open orders holding this item, and how they make up Qty. on Sales
 * Order. The sum is spelt out under the table: the counted lines, what else
 * Navision holds, and any short line held out of it as the demand under review.
 */
export function ItemOrders({ item }: { item: ItemDetail }) {
  const { t } = useTranslation("master-data");
  const { listed, other, heldOut } = item.salesOrderBreakdown;
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
          <dt className="text-muted-foreground">{t("item.orders.other")}</dt>
          <dd data-numeric className="text-right tabular-nums">
            {formatQuantity(other)}
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
