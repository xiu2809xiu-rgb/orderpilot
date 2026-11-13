import { Minus, TrendingDown, TrendingUp, type LucideIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { GradientText } from "../kit/GradientText";
import { NumberTicker } from "../kit/NumberTicker";
import { SpotlightCard } from "../kit/SpotlightCard";
import "./parts.css";

export interface KpiTrend {
  direction: "up" | "down" | "flat";
  /** The comparison in words, for example "12% more than last week". */
  text: string;
  /** Whether that direction is good news. Left out, the trend is neutral. */
  good?: boolean;
}

interface KpiTileProps {
  label: string;
  /** The figure; null when the data cannot support one, and then none is shown. */
  value: number | null;
  /** Written after the figure: a currency or a unit. */
  unit?: string;
  decimals?: number;
  trend?: KpiTrend;
  className?: string;
}

const TREND_ICON: Record<KpiTrend["direction"], LucideIcon> = {
  up: TrendingUp,
  down: TrendingDown,
  flat: Minus,
};

const group = (value: number, decimals: number): string =>
  new Intl.NumberFormat("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);

/**
 * One measure: a label, a figure that counts up once when first seen, and a
 * small trend in words. The figure is gradient type. The
 * tile is a card the pointer can light. With no figure it says so, and shows
 * no number.
 */
export function KpiTile({
  label,
  value,
  unit,
  decimals = 0,
  trend,
  className,
}: KpiTileProps) {
  const { t } = useTranslation("directions-parts");
  const TrendIcon = trend ? TREND_ICON[trend.direction] : null;
  const ticker =
    value === null ? null : (
      <NumberTicker
        value={value}
        decimalPlaces={decimals}
        format={(n) => group(n, decimals)}
      />
    );
  return (
    <SpotlightCard
      intensity={0.1}
      className={cn("dx-card kpi flex flex-col gap-2 p-4", className)}
    >
      <p className="fs-14 text-muted-foreground">{label}</p>
      <p className="fs-28 flex flex-wrap items-baseline gap-x-2">
        {value === null ? (
          <span className="fs-14 text-muted-foreground">
            {t("kpi.noFigure")}
          </span>
        ) : (
          <GradientText>{ticker}</GradientText>
        )}
        {value !== null && unit ? (
          <span className="fs-14 font-normal text-muted-foreground">
            {unit}
          </span>
        ) : null}
      </p>
      {trend && TrendIcon ? (
        <p
          className={cn(
            "fs-14 flex items-center gap-1.5",
            trend.good === undefined && "text-muted-foreground",
            trend.good === true && "text-success",
            trend.good === false && "text-destructive",
          )}
        >
          <TrendIcon className="size-3.5 shrink-0" aria-hidden="true" />
          <span className="sr-only">{t(`kpi.${trend.direction}`)}: </span>
          {trend.text}
        </p>
      ) : null}
    </SpotlightCard>
  );
}
