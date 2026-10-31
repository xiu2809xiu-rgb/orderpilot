import { useTranslation } from "react-i18next";
import type { Kpi } from "@orderpilot/shared";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/** One tile for each measure: the two figures and how the measure is worded. */
export function KpiTiles({ measures }: { measures: readonly Kpi[] }) {
  const { t } = useTranslation("insights");
  return (
    <ul className="grid gap-s2 sm:grid-cols-2 xl:grid-cols-3">
      {measures.map((kpi) => (
        <li key={kpi.id}>
          <Card className="h-full">
            <CardHeader>
              <CardTitle className="text-base">
                <h2>{kpi.label}</h2>
              </CardTitle>
              <p className="text-sm text-muted-foreground">{kpi.unit}</p>
            </CardHeader>
            <CardContent className="space-y-s2">
              <dl className="grid grid-cols-2 gap-s2">
                <div>
                  <dt className="text-xs text-muted-foreground">
                    {t("kpi.manual")}
                  </dt>
                  <dd className="text-2xl font-semibold tabular-nums">
                    {kpi.manual}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">
                    {t("kpi.withOrderPilot")}
                  </dt>
                  <dd className="text-2xl font-semibold tabular-nums">
                    {kpi.withOrderPilot}
                  </dd>
                </div>
              </dl>
              <p className="text-sm text-muted-foreground">
                <span className="font-medium text-foreground">
                  {t("kpi.definition")}:
                </span>{" "}
                {kpi.definition}
              </p>
            </CardContent>
          </Card>
        </li>
      ))}
    </ul>
  );
}
