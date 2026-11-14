import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { GradientText } from "@/components/kit/GradientText";
import { DemoBadge, NumberTicker, SectionCard } from "@/components/common";
import { useInsightsKpis } from "@/lib/api/generated/endpoints/insights/insights";
import { QueryBoundary } from "@/features/workflows/QueryBoundary";
import { KpiSparkline } from "./KpiSparkline";

/**
 * Spectra's five measures: where each stands, its target and twelve weeks of
 * trend. Its own lazy chunk, so the chart library loads for this block only.
 */
export default function KpiTrends() {
  const { t } = useTranslation(["insights", "home"]);
  const query = useInsightsKpis();
  const measures = query.data?.data.measures ?? [];
  return (
    <SectionCard
      title={t("kpis.title", { ns: "home" })}
      actions={
        <>
          <DemoBadge kind="mock" />
          <Link
            to="/insights"
            className="text-sm font-medium text-primary underline-offset-4 hover:underline"
          >
            {t("kpis.viewAll", { ns: "home" })}
          </Link>
        </>
      }
    >
      <QueryBoundary query={query}>
        <ul className="grid gap-s2 sm:grid-cols-2 lg:grid-cols-5">
          {measures.map((kpi) => (
            <li
              key={kpi.id}
              className="min-w-0 space-y-1 rounded-xl border border-border bg-(--dx-card-work-bg) p-s2"
            >
              <h3 className="text-sm font-medium">{kpi.label}</h3>
              <p className="flex flex-wrap items-baseline gap-x-1.5">
                <span className="text-2xl font-semibold tracking-tight tabular-nums">
                  <GradientText>
                    <NumberTicker value={kpi.withOrderPilot} />
                  </GradientText>
                </span>
                <span className="text-xs text-muted-foreground">
                  {kpi.unit}
                </span>
              </p>
              {kpi.target === undefined ? null : (
                <p className="text-xs text-muted-foreground tabular-nums">
                  {t("kpis.target", { ns: "home", value: kpi.target })}
                </p>
              )}
              <KpiSparkline kpi={kpi} unit={kpi.unit} />
            </li>
          ))}
        </ul>
      </QueryBoundary>
    </SectionCard>
  );
}
