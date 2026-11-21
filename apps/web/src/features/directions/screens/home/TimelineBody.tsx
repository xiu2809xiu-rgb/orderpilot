import type { WorkflowTask } from "@orderpilot/shared";
import type { TFunction } from "i18next";
import { useTranslation } from "react-i18next";
import { formatDay } from "@/lib/format";
import { waitParts } from "../../data/timer";
import type { Usual } from "../../data/estimates";
import {
  Timeline,
  TimelineContent,
  TimelineDate,
  TimelineHeader,
  TimelineIndicator,
  TimelineItem,
  TimelineSeparator,
  TimelineTitle,
} from "@/components/kit/Timeline";
import { JourneyRail } from "@/components/parts/JourneyRail";
import { StatusTag } from "@/components/parts/StatusTag";
import { enterProps, useFirstView } from "./entrance";
import { TimelineGroup } from "./TimelineGroup";
import type { TimelineEntry } from "./timelineModel";

/** The order and customer under a task's title, as the list above shows them. */
function OrderLine({ task }: { task: WorkflowTask }) {
  const customer = task.customerName ? ` · ${task.customerName}` : "";
  return (
    <TimelineDate
      dateTime={undefined}
    >{`${task.orderNo ?? ""}${customer}`}</TimelineDate>
  );
}

function waitedText(t: TFunction<"directions-home">, since: Date, at: Date) {
  // Calendar days in Singapore, as the order's page counts them.
  const parts = waitParts(since, at);
  if (parts.unit === "days") {
    return t("timeline.now.waiting_days", { count: parts.amount });
  }
  if (parts.unit === "hours") {
    return t("timeline.now.waiting_hours", { count: parts.amount });
  }
  return t("timeline.now.waiting_minutes", {
    count: Math.max(1, parts.amount),
  });
}

function usualText(t: TFunction<"directions-parts">, usual: Usual) {
  if (usual.kind === "sameDay") return t("usual.sameDay");
  return t(usual.kind === "hours" ? "usual.hours" : "usual.days", {
    count: usual.amount,
  });
}

export function NowGroup({
  entry,
  at,
}: {
  entry: TimelineEntry | null;
  at: Date;
}) {
  const { t } = useTranslation("directions-home");
  const { t: tParts } = useTranslation("directions-parts");
  const first = useFirstView();
  return (
    <TimelineGroup title={t("timeline.now.title")}>
      {entry ? (
        <Timeline value={0}>
          <TimelineItem step={1} {...enterProps(1, first)}>
            <TimelineIndicator className="home-pulse border-ring bg-background" />
            <TimelineHeader>
              <TimelineTitle>
                {t(`needs.kind.${entry.task.kind}`)}
              </TimelineTitle>
              <OrderLine task={entry.task} />
            </TimelineHeader>
            <TimelineContent className="flex flex-col gap-2.5 pt-1.5">
              <JourneyRail
                flow="sales"
                size="row"
                current={entry.position}
                late={entry.pastUsual === true}
              />
              <p className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="numeral text-foreground">
                  {waitedText(t, entry.since, at)}
                </span>
                {entry.usual ? (
                  <span>{usualText(tParts, entry.usual)}</span>
                ) : null}
              </p>
              {entry.pastUsual === true ? (
                <span>
                  <StatusTag
                    tone="waiting"
                    label={t("timeline.now.pastUsual")}
                  />
                </span>
              ) : null}
            </TimelineContent>
          </TimelineItem>
        </Timeline>
      ) : null}
    </TimelineGroup>
  );
}

function expectedText(
  t: TFunction<"directions-home">,
  tParts: TFunction<"directions-parts">,
  entry: TimelineEntry,
) {
  if (!entry.expected || !entry.usual) return t("timeline.next.noEstimate");
  if (entry.pastUsual) {
    return t("timeline.next.pastUsual", {
      usual: usualText(tParts, entry.usual),
    });
  }
  return t("timeline.next.expectedDay", { day: formatDay(entry.expected.at) });
}

export function NextGroup({ entries }: { entries: readonly TimelineEntry[] }) {
  const { t } = useTranslation("directions-home");
  const { t: tParts } = useTranslation("directions-parts");
  const first = useFirstView();
  return (
    <TimelineGroup title={t("timeline.next.title")}>
      {entries.length === 0 ? (
        <p className="fs-14 max-w-prose text-muted-foreground">
          {t("timeline.next.empty")}
        </p>
      ) : (
        <Timeline value={0}>
          {entries.map((entry, index) => (
            <TimelineItem
              key={entry.task.id}
              step={index + 1}
              {...enterProps(index + 2, first)}
            >
              <TimelineIndicator />
              <TimelineSeparator />
              <TimelineHeader>
                <TimelineTitle>
                  {t(`needs.kind.${entry.task.kind}`)}
                </TimelineTitle>
                <OrderLine task={entry.task} />
              </TimelineHeader>
              <TimelineContent>
                {expectedText(t, tParts, entry)}
              </TimelineContent>
            </TimelineItem>
          ))}
        </Timeline>
      )}
    </TimelineGroup>
  );
}
