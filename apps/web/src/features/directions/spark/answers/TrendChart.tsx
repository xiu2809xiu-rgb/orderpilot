import { useTranslation } from "react-i18next";
import {
  millions,
  monthName,
  type MonthPoint,
  type TrendFacts,
} from "../sparkFacts";

const WIDTH = 360;
const HEIGHT = 156;
const LEFT = 26;
const BOTTOM = 20;
const TOP = 8;

/** A nice top for the axis in USD millions: the next multiple of 5 above the data. */
function axisTop(points: readonly MonthPoint[]): number {
  const peak = Math.max(...points.map((p) => p.range?.high ?? p.amountUsd));
  return Math.ceil(peak / 5_000_000) * 5_000_000;
}

/**
 * Twelve months seen and six forecast, as bars. A month seen is a filled bar;
 * a forecast month is an outlined dashed bar with a line for its range, so the
 * two never rely on colour alone. The whole chart is one image with a spoken
 * summary, and the same figures are in the table view beside it.
 */
export function TrendChart({ facts }: { facts: TrendFacts }) {
  const { t } = useTranslation("directions-spark");
  const { points } = facts;
  const top = axisTop(points);
  const plotHeight = HEIGHT - BOTTOM - TOP;
  const step = (WIDTH - LEFT) / points.length;
  const barWidth = Math.floor(step * 0.62);
  const y = (value: number) => TOP + plotHeight * (1 - value / top);
  const seen = points.filter((p) => !p.forecast);
  const ahead = points.filter((p) => p.forecast);
  const lows = ahead.map((p) => p.range?.low ?? p.amountUsd);
  const highs = ahead.map((p) => p.range?.high ?? p.amountUsd);
  const label = t("trend.chartLabel", {
    first: monthName(seen[0]?.month ?? ""),
    lastSeen: monthName(seen[seen.length - 1]?.month ?? ""),
    count: ahead.length,
    low: millions(Math.min(...lows)),
    high: millions(Math.max(...highs)),
  });
  const gridlines = [0, 0.5, 1].map((share) => top * share);
  return (
    <figure className="flex flex-col gap-2">
      <svg
        role="img"
        aria-label={label}
        viewBox={`0 0 ${String(WIDTH)} ${String(HEIGHT)}`}
        className="block h-auto w-full text-foreground"
      >
        {gridlines.map((value) => (
          <g key={value}>
            <line
              x1={LEFT}
              x2={WIDTH}
              y1={y(value)}
              y2={y(value)}
              stroke="var(--border)"
              strokeWidth={1}
            />
            <text
              x={LEFT - 4}
              y={y(value) + 4}
              textAnchor="end"
              fontSize={12}
              className="numeral"
              fill="var(--muted-foreground)"
            >
              {String(Math.round(value / 1_000_000))}
            </text>
          </g>
        ))}
        {points.map((point, index) => {
          const x = LEFT + index * step + (step - barWidth) / 2;
          const center = x + barWidth / 2;
          return (
            <g key={point.month}>
              {point.forecast ? (
                <>
                  <rect
                    x={x}
                    y={y(point.amountUsd)}
                    width={barWidth}
                    height={y(0) - y(point.amountUsd)}
                    fill="none"
                    stroke="var(--ring)"
                    strokeWidth={1.5}
                    strokeDasharray="3 2"
                  />
                  <line
                    x1={center}
                    x2={center}
                    y1={y(point.range?.high ?? point.amountUsd)}
                    y2={y(point.range?.low ?? point.amountUsd)}
                    stroke="var(--foreground)"
                    strokeWidth={1.5}
                  />
                </>
              ) : (
                <rect
                  x={x}
                  y={y(point.amountUsd)}
                  width={barWidth}
                  height={y(0) - y(point.amountUsd)}
                  fill="var(--ring)"
                />
              )}
              {index % 3 === 0 ? (
                <text
                  x={center}
                  y={HEIGHT - 5}
                  textAnchor="middle"
                  fontSize={12}
                  fill="var(--muted-foreground)"
                >
                  {monthName(point.month)}
                </text>
              ) : null}
            </g>
          );
        })}
      </svg>
      <figcaption className="fs-12 flex flex-wrap items-center gap-x-4 gap-y-1 text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden="true" className="inline-block size-2.5 bg-ring" />
          {t("trend.legendSeen")}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span
            aria-hidden="true"
            className="inline-block size-2.5 border border-dashed border-ring"
          />
          {t("trend.legendForecast")}
        </span>
      </figcaption>
    </figure>
  );
}
