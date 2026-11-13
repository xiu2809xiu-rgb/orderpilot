import type { TimelineStep } from "@orderpilot/shared";
import { History } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Badge } from "../../kit/Badge";
import {
  Timeline,
  TimelineContent,
  TimelineDate,
  TimelineHeader,
  TimelineIndicator,
  TimelineItem,
  TimelineSeparator,
  TimelineTitle,
} from "../../kit/Timeline";
import { EmptyState } from "../../parts/EmptyState";

const STAMP = new Intl.DateTimeFormat("en-SG", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "Asia/Singapore",
});

/**
 * What happened on the order, newest first: who did it, when, and what it
 * changed, in our own words. The current step is lit and the rest are quiet. The
 * words and times are the tracker's own; money is posted in Business Central,
 * and the page says so.
 */
export function ActivityTab({ steps }: { steps: readonly TimelineStep[] }) {
  const { t } = useTranslation("directions-orders");
  if (steps.length === 0) {
    return (
      <EmptyState
        icon={History}
        title={t("order.activity.emptyTitle")}
        description={t("order.activity.emptyBody")}
      />
    );
  }
  const newestFirst = [...steps].reverse();
  return (
    <div className="od-activity">
      <p className="fs-13 max-w-prose text-muted-foreground">
        {t("order.activity.note")}
      </p>
      <Timeline value={newestFirst.length}>
        {newestFirst.map((step, index) => (
          <TimelineItem key={step.id} step={index + 1}>
            {/* Only the current step is lit: in Ink the accent means you are here. */}
            <TimelineIndicator
              className={
                step.current
                  ? ""
                  : "border-muted-foreground bg-muted-foreground"
              }
            />
            <TimelineSeparator className="bg-border" />
            <TimelineHeader>
              <TimelineTitle className="flex flex-wrap items-center gap-2">
                {step.title}
                {step.current ? (
                  <Badge variant="info" size="sm">
                    {t("order.activity.current")}
                  </Badge>
                ) : null}
              </TimelineTitle>
              <TimelineDate dateTime={step.at}>
                {t("order.activity.by", {
                  actor: step.actor,
                  when: STAMP.format(new Date(step.at)),
                })}
              </TimelineDate>
            </TimelineHeader>
            <TimelineContent>{step.effect}</TimelineContent>
          </TimelineItem>
        ))}
      </Timeline>
    </div>
  );
}
