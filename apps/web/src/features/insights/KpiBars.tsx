import { useTranslation } from "react-i18next";
import type { Kpi } from "@orderpilot/shared";

/**
 * One small chart for each measure, because each has its own unit and a
 * shared axis would mislead. Two bars from zero: by hand (outlined) and with
 * OrderPilot (solid), so the two read apart without colour. Each bar carries
 * its value as text, and the figure has a text label for screen readers. The
 * table view is the full alternative. This is its own chunk (lazy-loaded).
 */
export default function KpiBars({ measures }: { measures: readonly Kpi[] }) {
  const { t } = useTranslation("insights");
  return (
    <ul className="grid gap-s3 md:grid-cols-2 xl:grid-cols-3">
      {measures.map((kpi) => {
        const max = Math.max(kpi.manual, kpi.withOrderPilot, 1);
        const rows = [
          {
            key: "manual",
            label: t("kpi.manual"),
            value: kpi.manual,
            className: "border border-muted-foreground bg-secondary",
          },
          {
            key: "withOrderPilot",
            label: t("kpi.withOrderPilot"),
            value: kpi.withOrderPilot,
            className: "border border-primary bg-primary",
          },
        ];
        return (
          <li key={kpi.id}>
            <figure className="space-y-s1">
              <figcaption className="text-sm">
                <span className="font-medium">{kpi.label}</span>{" "}
                <span className="text-muted-foreground">({kpi.unit})</span>
              </figcaption>
              <div
                role="img"
                aria-label={t("kpi.chartLabel", {
                  label: kpi.label,
                  manual: kpi.manual,
                  withOrderPilot: kpi.withOrderPilot,
                  unit: kpi.unit,
                })}
                className="space-y-[2px]"
              >
                {rows.map((row) => (
                  <div key={row.key} className="flex items-center gap-2">
                    <span className="w-28 shrink-0 text-xs text-muted-foreground">
                      {row.label}
                    </span>
                    <div className="flex flex-1 items-center gap-2">
                      <div
                        title={`${row.label}: ${String(row.value)} ${kpi.unit}`}
                        className={`h-5 rounded-r-[4px] ${row.className}`}
                        style={{
                          width: `${String((row.value / max) * 100)}%`,
                          minWidth: 2,
                        }}
                      />
                      <span className="text-sm font-medium tabular-nums">
                        {row.value}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </figure>
          </li>
        );
      })}
    </ul>
  );
}
