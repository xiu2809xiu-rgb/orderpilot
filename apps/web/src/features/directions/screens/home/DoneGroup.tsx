import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import {
  Timeline,
  TimelineDate,
  TimelineHeader,
  TimelineIndicator,
  TimelineItem,
  TimelineSeparator,
  TimelineTitle,
} from "@/components/kit/Timeline";
import type { DoneItem } from "./doneToday";
import { enterProps, useFirstView } from "./entrance";
import { useOrderLinks } from "./homeLinks";
import { TimelineGroup } from "./TimelineGroup";

const TIME = new Intl.DateTimeFormat("en-GB", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Asia/Singapore",
});

/**
 * What the person finished today, from this screen or from an order's page,
 * newest first. Each line says what was done, for which order and when
 * ("Raised the SPR for SO-0082 at 06:03") and is the link to that order, so a
 * person who wants to see the result is one click from it. The real tasks API
 * lists only open tasks, so this list is the browser's own (`doneToday.ts`)
 * and an Undo takes a line out again. The hint says what is listed and what
 * is not: a payment and an SPR decision are made on the workflow's own pages.
 */
export function DoneGroup({ done }: { done: readonly DoneItem[] }) {
  const { t } = useTranslation("directions-home");
  const { t: tHome } = useTranslation("home");
  const first = useFirstView();
  const links = useOrderLinks();
  return (
    <TimelineGroup title={t("timeline.done.title")}>
      <p className="dx-meta max-w-prose">{t("timeline.done.hint")}</p>
      {done.length === 0 ? (
        <p className="fs-14 max-w-prose text-faint-foreground">
          {t("timeline.done.empty")}
        </p>
      ) : (
        <Timeline value={done.length}>
          {done.map(({ kind, orderNo, customerName, at }, index) => {
            // Every kind has its words, including two that nothing records now
            // (a payment, a review): an earlier build may have left such a line
            // in this browser, and a missing key would print as the key.
            const what = tHome(`needs.done.${kind}`, { orderNo });
            const line = t("timeline.done.at", {
              what,
              time: TIME.format(at),
            });
            return (
              <TimelineItem
                key={`${kind}-${orderNo}-${String(at.getTime())}`}
                step={index + 1}
                {...enterProps(index, first)}
              >
                <TimelineIndicator />
                <TimelineSeparator />
                <TimelineHeader>
                  <TimelineTitle>
                    <Link
                      to={links.order(orderNo)}
                      className="text-ring underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-ring"
                    >
                      {line}
                    </Link>
                  </TimelineTitle>
                  {customerName ? (
                    <TimelineDate quiet dateTime={undefined}>
                      {customerName}
                    </TimelineDate>
                  ) : null}
                </TimelineHeader>
              </TimelineItem>
            );
          })}
        </Timeline>
      )}
    </TimelineGroup>
  );
}
