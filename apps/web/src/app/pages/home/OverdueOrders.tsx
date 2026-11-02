import type { TrackerOrder } from "@orderpilot/shared";
import { useTranslation } from "react-i18next";
import { Money, SectionCard } from "@/components/common";
import { RecordLink } from "@/components/common/RecordLink";
import { buttonVariants } from "@/components/ui/button";
import { QueryBoundary } from "@/features/workflows/QueryBoundary";
import { useTrackerList } from "@/lib/api/generated/endpoints/tracker/tracker";
import { CustomerName } from "./CustomerName";
import { HomeEmpty, HomeTable, ViewAll, type HomeColumn } from "./HomeTable";

const ALL = "/order-tracker?overdue=true";

/** Management's list: the five overdue orders worth the most. */
export function OverdueOrders() {
  const { t } = useTranslation("home");
  const query = useTrackerList({
    overdue: "true",
    sort: "amount",
    direction: "desc",
    pageSize: 5,
  });
  const orders = (query.data?.data ?? []) as TrackerOrder[];
  const total = query.data?.meta.total ?? 0;
  const columns: HomeColumn[] = [
    { id: "what", label: t("overdue.status"), single: true },
    { id: "order", label: t("needs.columns.order") },
    { id: "customer", label: t("needs.columns.customer") },
    { id: "amount", label: t("needs.columns.amount"), end: true },
    { id: "late", label: t("needs.columns.late"), end: true },
    { id: "action", label: t("needs.columns.action"), action: true },
  ];

  return (
    <SectionCard
      title={t("overdue.title")}
      actions={
        total > 0 ? (
          <ViewAll to={ALL} label={t("needs.viewAll", { total })} />
        ) : undefined
      }
    >
      <QueryBoundary query={query}>
        {orders.length === 0 ? (
          <HomeEmpty
            title={t("overdue.emptyTitle")}
            description={t("overdue.emptyDescription")}
            to="/order-tracker"
            action={t("needs.emptyAction")}
          />
        ) : (
          <HomeTable
            label={t("overdue.table")}
            columns={columns}
            rows={orders.map((order) => ({
              id: order.orderNo,
              cells: {
                what: order.status.label,
                order: (
                  <RecordLink
                    to={`/order-tracker/${order.orderNo}`}
                    className="inline-flex min-h-6 items-center font-mono text-primary underline-offset-4 hover:underline"
                  >
                    {order.orderNo}
                  </RecordLink>
                ),
                customer: <CustomerName name={order.customerName} />,
                amount: order.amount ? (
                  <Money value={order.amount} currency={order.currencyCode} />
                ) : null,
                late: t("overdue.daysLate", {
                  count: order.overdue.daysOverdue,
                }),
                action: (
                  <RecordLink
                    to={`/order-tracker/${order.orderNo}`}
                    className={buttonVariants({
                      variant: "outline",
                      size: "sm",
                    })}
                    aria-label={t("needs.actionOn", {
                      action: t("overdue.open"),
                      what: order.orderNo,
                    })}
                  >
                    {t("overdue.open")}
                  </RecordLink>
                ),
              },
            }))}
          />
        )}
      </QueryBoundary>
    </SectionCard>
  );
}
