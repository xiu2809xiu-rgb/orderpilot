import type { OrderTimelineEvent, OverdueFlag } from "@orderpilot/shared";
import { Clock } from "lucide-react";
import { StatusChip } from "@/components/kit/StatusChip";
import { useTranslation } from "react-i18next";
import { LatestAct } from "./LatestAct";

/**
 * What a person needs before anything else, under the title: the sentence
 * that says who has the order, why and what comes next, then the latest act a
 * person made on it, then, only when it is late, the one badge that says so
 * with the tracker's own reason and date. Lateness is said here and nowhere
 * else on the page.
 */
export function OrderStatus({
  orderNo,
  sentence,
  overdue,
  timeline,
}: {
  orderNo: string;
  sentence: string;
  overdue: OverdueFlag;
  timeline: readonly OrderTimelineEvent[] | undefined;
}) {
  const { t } = useTranslation("directions-orders");
  return (
    <div className="od-status">
      <p className="od-status-sentence fs-16 font-medium text-foreground">
        {sentence}
      </p>
      <div className="od-status-meta">
        <LatestAct orderNo={orderNo} timeline={timeline} />
        {overdue.overdue ? (
          <p className="od-late fs-14">
            <StatusChip kind="destructive" icon={Clock}>
              {t("cells.late", { count: overdue.daysOverdue })}
            </StatusChip>
            {overdue.reason ? (
              <span className="text-muted-foreground">{overdue.reason}</span>
            ) : null}
          </p>
        ) : null}
      </div>
    </div>
  );
}
