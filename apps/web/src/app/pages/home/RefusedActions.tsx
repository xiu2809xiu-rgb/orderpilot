import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { RelativeTime, SectionCard } from "@/components/common";
import { buttonVariants } from "@/components/ui/button";
import { QueryBoundary } from "@/features/workflows/QueryBoundary";
import { useAuditViewerList } from "@/lib/api/generated/endpoints/audit/audit";
import { HomeEmpty, HomeTable, ViewAll, type HomeColumn } from "./HomeTable";

const ALL = "/audit?refusals=1";

/** The auditor's list: the five latest refused actions from the trail. */
export function RefusedActions() {
  const { t } = useTranslation(["home", "common"]);
  const query = useAuditViewerList({ refusalsOnly: "true", pageSize: 5 });
  const events = query.data?.data ?? [];
  const total = query.data?.meta.total ?? 0;
  const columns: HomeColumn[] = [
    { id: "what", label: t("refused.columns.what") },
    { id: "when", label: t("refused.columns.when") },
    { id: "action", label: t("needs.columns.action"), action: true },
  ];

  return (
    <SectionCard
      title={t("refused.title")}
      actions={
        total > 0 ? (
          <ViewAll to={ALL} label={t("needs.viewAll", { total })} />
        ) : undefined
      }
    >
      <QueryBoundary query={query}>
        {events.length === 0 ? (
          <HomeEmpty
            title={t("refused.emptyTitle")}
            description={t("refused.emptyDescription")}
            to="/audit"
            action={t("refused.emptyAction")}
          />
        ) : (
          <HomeTable
            label={t("refused.table")}
            columns={columns}
            rows={events.map((event) => ({
              id: event.id,
              cells: {
                what: event.summary,
                when: <RelativeTime value={event.occurredAt} />,
                action: (
                  <Link
                    to={`/audit?event=${event.id}`}
                    className={buttonVariants({
                      variant: "outline",
                      size: "sm",
                    })}
                    aria-label={t("needs.actionOn", {
                      action: t("refused.open"),
                      what: event.summary,
                    })}
                  >
                    {t("refused.open")}
                  </Link>
                ),
              },
            }))}
          />
        )}
      </QueryBoundary>
    </SectionCard>
  );
}
