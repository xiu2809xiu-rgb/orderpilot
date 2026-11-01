import type { Kpi } from "@orderpilot/shared";
import { useTranslation } from "react-i18next";
import { Line, LineChart, ReferenceLine, YAxis } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipBox,
} from "@/components/ui/chart";
import { formatDay } from "@/lib/format";

const CONFIG = {
  value: { label: "Value", color: "var(--primary)" },
  target: { label: "Target", color: "var(--muted-foreground)" },
};

interface Point {
  weekStart: string;
  value: number;
}

/**
 * Twelve weeks of one measure, with its target as a dashed line. A single
 * series, so the card's title names it and no legend is needed. It does not
 * animate: the page's only motion is the number above it.
 */
export function KpiSparkline({ kpi, unit }: { kpi: Kpi; unit: string }) {
  const { t } = useTranslation("insights");
  const weekly = kpi.weekly ?? [];
  const first = weekly[0];
  const last = weekly.at(-1);
  if (!first || !last) return null;
  const values = [...weekly.map((point) => point.value), kpi.target ?? 0];
  const domain = [Math.min(...values), Math.max(...values)];
  return (
    <div
      role="img"
      aria-label={t("trend.label", {
        weeks: weekly.length,
        from: first.value,
        to: last.value,
        unit,
      })}
    >
      <ChartContainer config={CONFIG} className="h-12">
        <LineChart
          data={weekly}
          margin={{ top: 4, right: 4, bottom: 4, left: 4 }}
        >
          <YAxis hide domain={domain} />
          {kpi.target === undefined ? null : (
            <ReferenceLine
              y={kpi.target}
              stroke="var(--color-target)"
              strokeDasharray="3 3"
            />
          )}
          <ChartTooltip
            cursor={{ stroke: "var(--border)" }}
            isAnimationActive={false}
            content={({ active, payload }) => {
              const point = payload[0]?.payload as Point | undefined;
              if (!active || !point) return null;
              return (
                <ChartTooltipBox title={formatDay(point.weekStart)}>
                  {point.value}
                </ChartTooltipBox>
              );
            }}
          />
          <Line
            dataKey="value"
            stroke="var(--color-value)"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
            isAnimationActive={false}
          />
        </LineChart>
      </ChartContainer>
    </div>
  );
}
