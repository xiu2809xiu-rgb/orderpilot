import { ChartColumn } from "lucide-react";
import { lazy, Suspense, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  DemoBadge,
  EmptyState,
  ErrorPanel,
  LoadingState,
  PageHeader,
  PermissionDenied,
  SectionCard,
} from "@/components/common";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useInsightsKpis } from "@/lib/api/generated/endpoints/insights/insights";
import { isForbidden } from "@/lib/query-status";
import { KpiTable } from "./KpiTable";
import { KpiTiles } from "./KpiTiles";

// The charts are their own chunk: the page shows its figures first.
const KpiBars = lazy(() => import("./KpiBars"));

/** The KPI dashboard: Spectra's five measures, labelled as mock lab estimates. */
export default function InsightsPage() {
  const { t } = useTranslation("insights");
  const kpis = useInsightsKpis();
  const [asTable, setAsTable] = useState(false);
  const set = kpis.data?.data;

  return (
    <div className="space-y-s4">
      <PageHeader
        title={t("title")}
        description={t("description")}
        meta={
          <>
            <DemoBadge kind="mock" />
            <Badge variant="outline" title={t("kpi.labEstimateHint")}>
              {t("kpi.labEstimate")}
            </Badge>
          </>
        }
      />
      {kpis.isPending ? (
        <LoadingState lines={6} />
      ) : kpis.isError ? (
        isForbidden(kpis.error) ? (
          <PermissionDenied />
        ) : (
          <ErrorPanel error={kpis.error} onRetry={() => void kpis.refetch()} />
        )
      ) : !set || set.measures.length === 0 ? (
        <EmptyState
          icon={ChartColumn}
          title={t("kpi.emptyTitle")}
          description={t("kpi.emptyDescription")}
        />
      ) : (
        <>
          <p className="measure text-muted-foreground">{set.note}</p>
          <KpiTiles measures={set.measures} />
          <SectionCard
            title={t("kpi.chartTitle")}
            description={t("kpi.chartDescription")}
            actions={
              <Button
                variant="outline"
                size="sm"
                aria-pressed={asTable}
                onClick={() => {
                  setAsTable((on) => !on);
                }}
              >
                {asTable ? t("kpi.chartToggle") : t("kpi.tableToggle")}
              </Button>
            }
          >
            {asTable ? (
              <KpiTable measures={set.measures} />
            ) : (
              <Suspense fallback={<LoadingState lines={3} />}>
                <KpiBars measures={set.measures} />
              </Suspense>
            )}
          </SectionCard>
        </>
      )}
    </div>
  );
}
