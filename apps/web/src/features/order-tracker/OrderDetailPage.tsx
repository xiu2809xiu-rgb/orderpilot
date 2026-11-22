import { ArrowLeft, FileQuestion } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link, useParams } from "react-router";
import type { OrderTimeline } from "@orderpilot/shared";
import {
  DemoBadge,
  ErrorPanel,
  OperationLog,
  PageHeader,
  PageHeaderSkeleton,
  PermissionDenied,
  SectionCardSkeleton,
  StatePanel,
  type OperationLogRow,
} from "@/components/common";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError } from "@/lib/api/errors";
import { useTrackerTimeline } from "@/lib/api/generated/endpoints/tracker/tracker";
import { isForbidden } from "@/lib/query-status";
import { CheckResults } from "./CheckResults";
import { OrderFacts } from "./OrderFacts";
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
  const { t: tl } = useTranslation("components");
  const { orderNo = "" } = useParams();
  const timeline = useTrackerTimeline(orderNo);
  const back = (
    <Button
      asChild
      variant="ghost"
      size="sm"
      className="-mb-s2 -ml-2 self-start text-muted-foreground pointer-coarse:h-11"
    >
      <Link to="/order-tracker">
        <ArrowLeft aria-hidden="true" />
        {t("detail.back")}
      </Link>
    </Button>
  );

  if (timeline.isPending) {
    return (
      <Sheet>
        <div role="status" aria-busy="true" className="contents">
          <span className="sr-only">{tl("states.loading")}</span>
          <PageHeaderSkeleton />
          <Skeleton
            className="h-24 w-full animate-none rounded-xl"
            aria-hidden="true"
          />
          <SectionCardSkeleton lines={4} />
          <SectionCardSkeleton lines={4} />
        </div>
      </Sheet>
    );
  }
  if (timeline.isError) {
    if (isForbidden(timeline.error)) {
      return (
        <Sheet>
          {back}
          <PermissionDenied />
        </Sheet>
      );
    }
    if (
      timeline.error instanceof ApiError &&
      timeline.error.code === "NOT_FOUND"
    ) {
      return (
        <Sheet>
          {back}
          <StatePanel
            icon={FileQuestion}
            title={t("detail.notFoundTitle")}
            description={t("detail.notFoundDescription")}
          />
        </Sheet>
      );
    }
    return (
      <Sheet>
        {back}
        <ErrorPanel
          error={timeline.error}
          onRetry={() => void timeline.refetch()}
        />
      </Sheet>
    );
  }

  const order = timeline.data.data;
  return (
    <Sheet>
      {back}
      <PageHeader
        title={order.orderNo}
        description={order.customerName}
        meta={<DemoBadge kind="mock" />}
      />
      <OrderFacts order={order} />
      <StepChain steps={order.steps} />
      <CheckResults checks={order.checks} />
      <MasterMatches matches={order.matches} />
      <OperationLog rows={mockLogRows(order, t("detail.log.ip"))} demo />
    </Sheet>
  );
}

/** The column the order page sits in: 72 rem, with its sections one stack apart. */
function Sheet({ children }: { children: React.ReactNode }) {
  return <div className="dx-sheet dx-page">{children}</div>;
}
