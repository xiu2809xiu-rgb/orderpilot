import type { TrackerOrder } from "@orderpilot/shared";
import { ArrowRight, TriangleAlert } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { Money } from "@/components/common";
import { StatusChip } from "@/components/kit/StatusChip";
import { Button } from "@/components/ui/button";
import { BlockSection } from "./BlockSection";
import { HomeRow } from "./HomeRow";
import { RecordLinkText } from "./RecordLinkText";
import { useOrderLinks } from "./homeLinks";
import type { useBlockQueries } from "./useBlockQueries";

/** The whole list this block is the top of, as the tracker's address: `links.list` moves it. */
const ALL = "/order-tracker?overdue=true";

/**
 * Management's block: the overdue orders worth the most. Each row says where
 * the order stands, how late it is and what it is worth, and opens the order.
 */
export function OverdueBlock({
  query,
}: {
  query: ReturnType<typeof useBlockQueries>["overdue"];
}) {
  const { t } = useTranslation("directions-home");
  const { t: tHome } = useTranslation("home");
  const links = useOrderLinks();
  const orders: TrackerOrder[] = query.data?.data ?? [];
  return (
    <BlockSection
      title={tHome("overdue.title")}
      query={query}
      items={orders}
      itemKey={(order) => order.orderNo}
      empty={{
        title: tHome("overdue.emptyTitle"),
        description: tHome("overdue.emptyDescription"),
      }}
      viewAll={{ to: links.list(ALL), total: query.data?.meta.total ?? 0 }}
      row={(order) => (
        <HomeRow
          title={order.status.label}
          meta={
            <>
              <RecordLinkText to={links.order(order.orderNo)}>
                {order.orderNo}
              </RecordLinkText>
              <span className="min-w-0 truncate" title={order.customerName}>
                {order.customerName}
              </span>
            </>
          }
          trailing={
            <>
              <StatusChip kind="destructive" icon={TriangleAlert}>
                {t("block.overdue.late", { count: order.overdue.daysOverdue })}
              </StatusChip>
              {order.amount ? (
                <Money
                  value={order.amount}
                  currency={order.currencyCode}
                  className="fs-14 text-muted-foreground"
                />
              ) : null}
            </>
          }
          action={
            <Button
              asChild
              variant="outline"
              size="sm"
              className="w-full pointer-coarse:min-h-11"
            >
              <Link
                to={links.order(order.orderNo)}
                aria-label={t("block.actionOn", {
                  action: tHome("overdue.open"),
                  record: order.orderNo,
                })}
              >
                {tHome("overdue.open")}
                <ArrowRight aria-hidden="true" />
              </Link>
            </Button>
          }
        />
      )}
    />
  );
}
