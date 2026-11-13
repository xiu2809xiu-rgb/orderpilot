import { Lock } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Skeleton } from "@/components/ui/skeleton";
import { useInsightsKpis } from "@/lib/api/generated/endpoints/insights/insights";
import { useTrackerFlow } from "@/lib/api/generated/endpoints/tracker/tracker";
import { useSessionStore } from "@/stores/session";
import { KpiTile } from "../../parts/KpiTile";
import { Section } from "../../parts/Section";
import type { useHomeTasks } from "./useHomeTasks";

const decimalsOf = (value: number): number => (Number.isInteger(value) ? 0 : 1);

/**
 * The figures of the home screen. First the person's own: open orders from the
 * tracker, and the tasks waiting and late. Then Spectra's five measures from
 * the insights API, for the roles that may read them, or the plain reason
 * they are not shown. The measures are lab estimates and the screen says so.
 */
export function Measures({ home }: { home: ReturnType<typeof useHomeTasks> }) {
  const { t } = useTranslation("directions-home");
  const flow = useTrackerFlow();
  const mayRead = useSessionStore(
    (state) => state.session?.permissions.includes("insights.read") ?? false,
  );
  const kpis = useInsightsKpis({ query: { enabled: mayRead } });
  const open = flow.data?.data.openOrders ?? null;
  const settled = !home.list.isPending;

  return (
    <>
      <Section title={t("measures.title")}>
        <div className="grid gap-3 sm:grid-cols-3">
          <KpiTile
            label={t("measures.open")}
            value={open}
            unit={t("measures.orders")}
          />
          <KpiTile
            label={t("measures.waiting")}
            value={settled ? home.total : null}
            unit={t("measures.tasks")}
          />
          <KpiTile
            label={t("measures.late")}
            value={settled ? home.late : null}
            unit={t("measures.tasks")}
          />
        </div>
      </Section>
      <Section title={t("measures.five")}>
        {!mayRead ? (
          <p className="fs-14 flex max-w-prose items-start gap-2 text-muted-foreground">
            <Lock className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            {t("measures.noAccess")}
          </p>
        ) : kpis.isError ? (
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
            <p className="fs-13 mt-4 max-w-prose text-muted-foreground">
              {t("measures.lab", { note: kpis.data.data.note })}
            </p>
          </>
        ) : (
          <Skeleton className="h-28" aria-hidden="true" />
        )}
      </Section>
    </>
  );
}
