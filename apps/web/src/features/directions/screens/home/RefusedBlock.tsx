import { ArrowRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { RelativeTime } from "@/components/common";
import { Button } from "@/components/ui/button";
import { BlockSection } from "./BlockSection";
import { HomeRow } from "./HomeRow";
import { RecordLinkText } from "./RecordLinkText";
import type { useBlockQueries } from "./useBlockQueries";

const ALL = "/audit?refusals=1";

/**
 * The latest actions the system refused, newest first: the block of a role
 * that reads the audit trail without managing settings, and the one a role
 * that manages settings and reads the audit trail has below its rules. Each
 * row says what was refused and who asked, links the event, and opens it in
 * the audit trail, where its hash chain and changes are.
 */
export function RefusedBlock({
  query,
}: {
  query: ReturnType<typeof useBlockQueries>["refused"];
}) {
  const { t } = useTranslation("directions-home");
  const { t: tHome } = useTranslation("home");
  const events = query.data?.data ?? [];
  return (
    <BlockSection
      title={tHome("refused.title")}
      query={query}
      items={events}
      itemKey={(event) => event.id}
      empty={{
        title: tHome("refused.emptyTitle"),
        description: tHome("refused.emptyDescription"),
      }}
      viewAll={{ to: ALL, total: query.data?.meta.total ?? 0 }}
      row={(event) => (
        <HomeRow
          title={event.summary}
          meta={
            <>
              <RecordLinkText to={`/audit?event=${event.id}`}>
                {t("block.refused.event", { sequence: event.sequence })}
              </RecordLinkText>
              <span className="min-w-0 truncate" title={event.actorName}>
                {event.actorName}
              </span>
            </>
          }
          trailing={
            <span className="fs-14 text-muted-foreground">
              <RelativeTime value={event.occurredAt} />
            </span>
          }
          action={
            <Button
              asChild
              variant="outline"
              size="sm"
              className="w-full pointer-coarse:min-h-11"
            >
              <Link
                to={`/audit?event=${event.id}`}
                aria-label={t("block.actionOn", {
                  action: tHome("refused.open"),
                  record: event.summary,
                })}
              >
                {tHome("refused.open")}
                <ArrowRight aria-hidden="true" />
              </Link>
            </Button>
          }
        />
      )}
    />
  );
}
