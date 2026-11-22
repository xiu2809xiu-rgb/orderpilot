import { useTranslation } from "react-i18next";
import type { Kpi } from "@orderpilot/shared";
import { GradientText } from "@/components/kit/GradientText";
import { SpotlightCard } from "@/components/kit/SpotlightCard";

/**
 * One tile for each measure, drawn as the home page draws its five: the
 * label, then the figure in gradient type. The two figures stay side by side
 * and the draft definition under them, since this page is where a person
 * reads what each measure means.
 */
export function KpiTiles({ measures }: { measures: readonly Kpi[] }) {
  const { t } = useTranslation("insights");
  return (
    // With five tiles in three columns the last row is a tile and a hole: the
    // fifth takes the two columns, so the grid has no gap in it.
    <ul className="dx-grid-gap grid sm:grid-cols-2 xl:grid-cols-3 xl:[&>li:last-child:nth-child(3n+2)]:col-span-2">
      {measures.map((kpi) => (
        <li key={kpi.id}>
          <SpotlightCard
            intensity={0.1}
            className="dx-card flex h-full flex-col gap-4 p-6"
          >
            <div>
              <h2 className="fs-14 font-semibold text-foreground">
                {kpi.label}
              </h2>
              <p className="dx-meta">{kpi.unit}</p>
            </div>
            <dl className="grid grid-cols-2 gap-s2">
              <div>
                <dt className="dx-meta">{t("kpi.manual")}</dt>
                <dd className="fs-28 tabular-nums">{kpi.manual}</dd>
              </div>
              <div>
                <dt className="dx-meta">{t("kpi.withOrderPilot")}</dt>
                <dd className="fs-28 tabular-nums">
                  <GradientText>{kpi.withOrderPilot}</GradientText>
                </dd>
              </div>
            </dl>
            <p className="fs-14 text-muted-foreground">
              <span className="font-medium">{t("kpi.definition")}:</span>{" "}
              {kpi.definition}
            </p>
          </SpotlightCard>
        </li>
      ))}
    </ul>
  );
}
