import type { OrderTimelineEvent } from "@orderpilot/shared";
import { useTranslation } from "react-i18next";
import { EmptyState } from "@/components/common";
import { formatDateTime } from "./format";

/** What happened to the order, newest first. */
export function Timeline({
  events,
}: {
  events: readonly OrderTimelineEvent[];
}) {
  const { t } = useTranslation("workflows");
  if (events.length === 0) {
    return <EmptyState title={t("order.timelineEmpty")} />;
  }
  return (
    <ol className="space-y-3 border-l pl-s3">
      {[...events].reverse().map((event) => (
        <li key={event.id} className="space-y-1">
          <p className="font-medium">{event.summary}</p>
          <p className="text-sm text-muted-foreground">
            <time dateTime={event.at}>{formatDateTime(event.at)}</time>
            {" · "}
            {event.actor.name}
          </p>
        </li>
      ))}
    </ol>
  );
}
