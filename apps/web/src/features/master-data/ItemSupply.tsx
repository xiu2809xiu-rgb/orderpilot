import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import type { ItemDetail } from "@orderpilot/shared";
import { SectionCard, StatusBadge } from "@/components/common";
import { formatDay, formatQuantity } from "@/lib/format";
import { hasPermission, useSessionStore } from "@/stores/session";
import { MaskedMoney } from "./pieces";
import { RecordTable, type RecordColumn } from "./RecordTable";

type PurchaseLine = ItemDetail["purchaseLines"][number];
type Spr = ItemDetail["sprs"][number];

const SPR_TONE = {
  suggested: "neutral",
  submitted: "info",
  approved: "success",
} as const;

/** An SPR's number, as a link for the roles that may open one. */
function SprNumber({ recordNo }: { recordNo: string | null }) {
  const session = useSessionStore((state) => state.session);
  if (!recordNo) return null;
  if (!hasPermission(session, "spr.read")) {
    return <span className="font-mono">{recordNo}</span>;
  }
  return (
    <Link
      to={`/workflows/sprs/${recordNo}`}
      className="font-mono text-primary underline-offset-4 hover:underline"
    >
      {recordNo}
    </Link>
  );
}

/** What is on its way for this item: open purchase orders, then the item's SPRs. */
export function ItemSupply({ item }: { item: ItemDetail }) {
  const { t } = useTranslation("master-data");
  const purchaseColumns: RecordColumn<PurchaseLine>[] = [
    {
      id: "no",
      header: t("item.purchases.no"),
      cell: (line) => <span className="font-mono">{line.purchaseOrderNo}</span>,
    },
    {
      id: "spr",
      header: t("item.purchases.spr"),
      cell: (line) => <SprNumber recordNo={line.sprRecordNo} />,
    },
    {
      id: "orderDate",
      header: t("item.purchases.orderDate"),
      cell: (line) => formatDay(line.orderDate),
      kind: "date",
    },
    {
      id: "expected",
      header: t("item.purchases.expected"),
      cell: (line) => formatDay(line.expectedReceiptDate),
      kind: "date",
    },
    {
      id: "quantity",
      header: t("item.purchases.quantity"),
      cell: (line) => formatQuantity(line.outstandingQuantity),
      kind: "number",
    },
    {
      id: "unitCost",
      header: t("item.purchases.unitCost"),
      cell: (line) => <MaskedMoney field={line.unitCost} />,
      kind: "money",
    },
  ];
  const sprColumns: RecordColumn<Spr>[] = [
    {
      id: "recordNo",
      header: t("item.sprs.recordNo"),
      cell: (spr) => <SprNumber recordNo={spr.recordNo} />,
    },
    {
      id: "status",
      header: t("item.sprs.status"),
      cell: (spr) => (
        <StatusBadge tone={SPR_TONE[spr.status]}>
          {t(`item.sprs.statuses.${spr.status}`)}
        </StatusBadge>
      ),
    },
    {
      id: "order",
      header: t("item.sprs.order"),
      cell: (spr) => (
        <Link
          to={`/order-tracker/${spr.orderNo}`}
          className="font-mono text-primary underline-offset-4 hover:underline"
        >
          {spr.orderNo}
        </Link>
      ),
    },
    {
      id: "requestedBy",
      header: t("item.sprs.requestedBy"),
      cell: (spr) => spr.requestedBy,
    },
    {
      id: "needBy",
      header: t("item.sprs.needBy"),
      cell: (spr) => formatDay(spr.needBy),
      kind: "date",
    },
    {
      id: "quantity",
      header: t("item.sprs.quantity"),
      cell: (spr) => formatQuantity(spr.quantity),
      kind: "number",
    },
    {
      id: "navisionNo",
      header: t("item.sprs.navisionNo"),
      cell: (spr) =>
        spr.navisionNo ? (
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="font-mono">{spr.navisionNo}</span>
            {spr.purchaseOrderStatus ? (
              <StatusBadge
                tone={
                  spr.purchaseOrderStatus === "received" ? "success" : "info"
                }
              >
                {t(`item.sprs.purchaseOrder.${spr.purchaseOrderStatus}`)}
              </StatusBadge>
            ) : null}
          </span>
        ) : null,
      wrap: true,
    },
  ];
  return (
    <>
      <SectionCard
        title={t("item.purchases.title", { count: item.purchaseLines.length })}
        description={t("item.purchases.description", {
          total: formatQuantity(item.qtyOnPurchOrder),
        })}
      >
        <RecordTable
          caption={t("item.purchases.caption")}
          columns={purchaseColumns}
          rows={item.purchaseLines}
          rowKey={(line) => line.purchaseOrderNo}
          emptyText={t("item.purchases.empty")}
        />
      </SectionCard>
      <SectionCard title={t("item.sprs.title", { count: item.sprs.length })}>
        <RecordTable
          caption={t("item.sprs.caption")}
          columns={sprColumns}
          rows={item.sprs}
          rowKey={(spr) => spr.recordNo}
          emptyText={t("item.sprs.empty")}
        />
      </SectionCard>
    </>
  );
}
