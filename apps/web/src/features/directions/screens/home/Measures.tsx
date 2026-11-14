import { useTranslation } from "react-i18next";
import { Skeleton } from "@/components/ui/skeleton";
import { useInsightsKpis } from "@/lib/api/generated/endpoints/insights/insights";
import { KpiTile } from "@/components/parts/KpiTile";
import { Section } from "@/components/parts/Section";
import { useHomeAccess } from "./homeAccess";
import { YourNumbers } from "./YourNumbers";

const decimalsOf = (value: number): number => (Number.isInteger(value) ? 0 : 1);

/**
 * The figures of the home page. First the role's own counts, each opening its
 * list. Then Spectra's five measures from the insights API, for the roles that
 * may read them; a role that may not has no such section. The measures are lab
 * estimates and the page says so.
 */
export function Measures() {
  const { t } = useTranslation("directions-home");
  const mayRead = useHomeAccess().measures;
  const kpis = useInsightsKpis({ query: { enabled: mayRead } });

  return (
    <>
      <YourNumbers />
      {mayRead ? (
        <Section title={t("measures.five")}>
          {kpis.isError ? (
            <p role="alert" className="fs-14 text-destructive">
              {t("measures.failed")}
            </p>
          ) : kpis.data ? (
            <>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                {kpis.data.data.measures.map((measure) => (
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
                {t("measures.lab", { note: kpis.data.data.note })}
              </p>
            </>
          ) : (
            <Skeleton className="h-28" aria-hidden="true" />
          )}
        </Section>
      ) : null}
    </>
  );
}
