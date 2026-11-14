import { useTranslation } from "react-i18next";
import { Skeleton } from "@/components/ui/skeleton";
import { useInsightsKpis } from "@/lib/api/generated/endpoints/insights/insights";
import { KpiTile } from "@/components/parts/KpiTile";
import { Section } from "@/components/parts/Section";
import { HomeQuery } from "./HomeQuery";
import { useHomeAccess } from "./homeAccess";
import { TrendSection } from "./TrendSection";

const decimalsOf = (value: number): number => (Number.isInteger(value) ? 0 : 1);

/**
 * Spectra's five measures from the insights API, for the roles that may read
 * them; a role that may not has no such section. The measures are lab
 * estimates and the page says so. Management also gets the twelve-week trend
 * of each, the insights area's own chart, loaded only when it is wanted.
 */
export function Measures() {
  const { t } = useTranslation("directions-home");
  const access = useHomeAccess();
  const kpis = useInsightsKpis({ query: { enabled: access.measures } });
  if (!access.measures) return null;

  return (
    <>
      <Section title={t("measures.five")}>
        <HomeQuery
          query={kpis}
          loading={<Skeleton className="h-28" aria-hidden="true" />}
        >
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            {kpis.data?.data.measures.map((measure) => (
              <KpiTile
                key={measure.id}
                label={measure.label}
                value={measure.withOrderPilot}
                unit={measure.unit}
                decimals={decimalsOf(measure.withOrderPilot)}
                trend={{
                  direction:
                    measure.withOrderPilot < measure.manual ? "down" : "up",
                  good: measure.lowerIsBetter
                    ? measure.withOrderPilot < measure.manual
                    : measure.withOrderPilot > measure.manual,
                  text: t("measures.trend.byHand", {
                    value: measure.manual,
                    unit: measure.unit,
                  }),
                }}
              />
            ))}
          </div>
          <p className="fs-14 mt-4 max-w-prose text-muted-foreground">
            {t("measures.lab", { note: kpis.data?.data.note })}
          </p>
        </HomeQuery>
      </Section>
      {access.role === "MANAGEMENT" ? <TrendSection /> : null}
    </>
  );
}
