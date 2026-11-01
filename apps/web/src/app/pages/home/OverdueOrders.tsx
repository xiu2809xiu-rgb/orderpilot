import type { TrackerOrder } from "@orderpilot/shared";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { Money, SectionCard } from "@/components/common";
import { buttonVariants } from "@/components/ui/button";
import { QueryBoundary } from "@/features/workflows/QueryBoundary";
import { useTrackerList } from "@/lib/api/generated/endpoints/tracker/tracker";
import {
  HOME_FIRST_CELL,
  HomeEmpty,
  HomeTable,
  ViewAll,
  homeCell,
  type HomeColumn,
} from "./HomeTable";

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
    { id: "what", label: t("overdue.status") },
    { id: "order", label: t("needs.columns.order") },
    { id: "customer", label: t("needs.columns.customer") },
    { id: "amount", label: t("needs.columns.amount"), end: true },
    { id: "late", label: t("needs.columns.late"), end: true },
    { id: "action", label: t("needs.columns.action"), action: true },
  ];

  return (
    <SectionCard
      title={t("overdue.title")}
      className="h-full"
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
          <HomeTable label={t("overdue.title")} columns={columns}>
            {orders.map((order) => (
              <tr key={order.orderNo}>
                <td className={HOME_FIRST_CELL}>{order.status.label}</td>
                <td className={homeCell({})}>
                  <Link
                    to={`/order-tracker/${order.orderNo}`}
                    className="font-mono text-primary underline-offset-4 hover:underline"
                  >
                    {order.orderNo}
                  </Link>
                </td>
                <td className={`${homeCell({})} whitespace-normal`}>
                  {order.customerName}
                </td>
                <td className={homeCell({ end: true })}>
                  {order.amount ? (
                    <Money value={order.amount} currency={order.currencyCode} />
                  ) : null}
                </td>
                <td className={homeCell({ end: true })}>
                  {t("overdue.daysLate", { count: order.overdue.daysOverdue })}
                </td>
                <td className={homeCell({ action: true })}>
                  <Link
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
                  </Link>
                </td>
              </tr>
            ))}
          </HomeTable>
        )}
      </QueryBoundary>
    </SectionCard>
  );
}
