import type { OrderTimelineEvent, OverdueFlag } from "@orderpilot/shared";
import { Clock } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { Term } from "@/components/common/Term";
import { StatusChip } from "@/components/kit/StatusChip";
import { Button } from "@/components/ui/button";
import { ALL_DONE } from "../orders/orderRow";
import { LatestAct } from "./LatestAct";

/**
 * What a person needs before anything else, under the title, as one card:
 * the stage and the team that holds it, the one reason it is held when the
 * data gives one (a shortage, or a failed check), the latest act a person
 * made on the order, then, only when it is late, the one badge that says so
 * with the tracker's own reason and a way to the exceptions queue. Lateness
 * is said here and nowhere else on the page.
 */
export function OrderStatus({
  orderNo,
  sentence,
  overdue,
  timeline,
  stageLabel,
  heldAt,
  step,
}: {
  orderNo: string;
  sentence: string;
  overdue: OverdueFlag;
  timeline: readonly OrderTimelineEvent[] | undefined;
  stageLabel: string;
  heldAt: string;
  step: number | null;
}) {
  const { t } = useTranslation("directions-orders");
  return (
    <div className="od-status dx-card">
      <dl className="od-status-head">
        <div className="od-fact">
          <dt className="dx-section-title">{t("order.facts.currentStage")}</dt>
          <dd className="od-fact-value fs-20 font-semibold">{stageLabel}</dd>
        </div>
        <div className="od-fact od-status-held">
          <dt className="od-fact-label fs-12">
            <Term word="heldAt">{t("columns.heldAt")}</Term>
          </dt>
          <dd className="od-fact-value">
            {step === ALL_DONE ? t("cells.done") : heldAt}
          </dd>
        </div>
      </dl>
      {sentence ? (
        <p className="od-status-sentence fs-14 text-muted-foreground">
          {sentence}
        </p>
      ) : null}
      <div className="od-status-meta">
        <LatestAct orderNo={orderNo} timeline={timeline} />
        {overdue.overdue ? (
          <p className="od-late fs-14">
            <span className="od-late-info">
              <StatusChip kind="destructive" icon={Clock}>
                {t("cells.late", { count: overdue.daysOverdue })}
              </StatusChip>
              {overdue.reason ? (
                <span className="text-muted-foreground">{overdue.reason}</span>
              ) : null}
            </span>
            <Button asChild variant="outline" size="sm">
              <Link to={`/exceptions?search=${encodeURIComponent(orderNo)}`}>
                {t("order.facts.viewException")}
              </Link>
            </Button>
          </p>
        ) : null}
      </div>
    </div>
  );
}
