import { useTranslation } from "react-i18next";
import type { OrderTimeline } from "@orderpilot/shared";
import { StatusBadge } from "@/components/common";

/**
 * The order's facts on one card, label over value, as a customer's or an
 * item's page draws theirs. The status label is shown as area 2 reports it.
 */
export function OrderFacts({ order }: { order: OrderTimeline }) {
  const { t } = useTranslation("order-tracker");
  const { t: tc } = useTranslation("common");
  return (
    // Each fact is as wide as its own content and the row wraps when it must:
    // equal columns cut a long status chip off at the card's edge.
    <dl className="dx-card dx-card-work flex flex-wrap gap-x-s6 gap-y-s3 px-6 py-4">
      <Fact label={t("detail.externalDocumentNo")}>
        <span className="tabular-nums">{order.externalDocumentNo}</span>
      </Fact>
      <Fact label={t("detail.status")}>
        <StatusBadge className="h-auto max-w-full shrink whitespace-normal py-0.5 text-left">
          {order.status.label}
        </StatusBadge>
      </Fact>
      <Fact label={t("detail.owner")}>{tc(`roles.${order.ownerRole}`)}</Fact>
      <Fact label={t("detail.overdue")}>
        {order.overdue.overdue ? (
          <StatusBadge tone="danger">
            {t("list.overdueDays", { count: order.overdue.daysOverdue })}
          </StatusBadge>
        ) : (
          t("list.onTime")
        )}
        {order.overdue.reason ? (
          <span className="mt-1 block text-sm font-normal text-muted-foreground">
            {order.overdue.reason}
          </span>
        ) : null}
      </Fact>
    </dl>
  );
}

function Fact({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-w-0 max-w-full flex-col gap-1">
      <dt className="dx-meta">{label}</dt>
      <dd className="text-sm font-medium">{children}</dd>
    </div>
  );
}
