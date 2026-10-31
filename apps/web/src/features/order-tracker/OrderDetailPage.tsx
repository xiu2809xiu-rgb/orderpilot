import { ArrowLeft, FileQuestion } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link, useParams } from "react-router";
import type { OrderTimeline } from "@orderpilot/shared";
import {
  DemoBadge,
  ErrorPanel,
  LoadingState,
  OperationLog,
  PageHeader,
  PermissionDenied,
  StatePanel,
  StatusBadge,
  type OperationLogRow,
} from "@/components/common";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/api/errors";
import { useTrackerTimeline } from "@/lib/api/generated/endpoints/tracker/tracker";
import { isForbidden } from "@/lib/query-status";
import { CheckResults } from "./CheckResults";
import { MasterMatches } from "./MasterMatches";
import { StepChain } from "./StepChain";

/**
 * Mock rows for the operation log at the foot of the page, built from the
 * steps. F-2 feeds the log from the real audit trail and replaces this.
 */
function mockLogRows(timeline: OrderTimeline, ip: string): OperationLogRow[] {
  return timeline.steps
    .map((step) => ({
      id: step.id,
      at: step.at,
      user: step.actor,
      ip,
      change: step.title,
    }))
    .reverse();
}

export default function OrderDetailPage() {
  const { t } = useTranslation("order-tracker");
  const { t: tc } = useTranslation("common");
  const { orderNo = "" } = useParams();
  const timeline = useTrackerTimeline(orderNo);
  const back = (
    <Button asChild variant="ghost" size="sm">
      <Link to="/order-tracker">
        <ArrowLeft aria-hidden="true" />
        {t("detail.back")}
      </Link>
    </Button>
  );

  if (timeline.isPending) {
    return <LoadingState lines={6} />;
  }
  if (timeline.isError) {
    if (isForbidden(timeline.error)) return <PermissionDenied />;
    if (
      timeline.error instanceof ApiError &&
      timeline.error.code === "NOT_FOUND"
    ) {
      return (
        <StatePanel
          icon={FileQuestion}
          title={t("detail.notFoundTitle")}
          description={t("detail.notFoundDescription")}
        >
          {back}
        </StatePanel>
      );
    }
    return (
      <ErrorPanel
        error={timeline.error}
        onRetry={() => void timeline.refetch()}
      />
    );
  }

  const order = timeline.data.data;
  return (
    <div className="space-y-s4">
      {back}
      <PageHeader
        title={order.orderNo}
        description={order.customerName}
        meta={<DemoBadge kind="mock" />}
      />
      <dl className="grid gap-s2 sm:grid-cols-2 lg:grid-cols-4">
        <Fact label={t("detail.externalDocumentNo")}>
          <span className="font-mono">{order.externalDocumentNo}</span>
        </Fact>
        <Fact label={t("detail.status")}>
          <StatusBadge>{order.status.label}</StatusBadge>
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
            <span className="block text-sm text-muted-foreground">
              {order.overdue.reason}
            </span>
          ) : null}
        </Fact>
      </dl>
      <StepChain steps={order.steps} />
      <CheckResults checks={order.checks} />
      <MasterMatches matches={order.matches} />
      <OperationLog rows={mockLogRows(order, t("detail.log.ip"))} demo />
    </div>
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
    <div className="space-y-1 rounded-lg border p-s2">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}
