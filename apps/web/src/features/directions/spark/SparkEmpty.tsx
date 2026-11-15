import { ArrowUpRight, Package, TrendingUp } from "lucide-react";
import { useTranslation } from "react-i18next";
import { BlurFade } from "@/components/kit/BlurFade";
import type { SparkKind } from "./useSparkChat";

interface SparkEmptyProps {
  /** Whether the role may read sales figures: the trend question needs it. */
  mayReadSales: boolean;
  onAsk: (question: string, kind: SparkKind) => void;
}

/**
 * What the panel shows before the first question: what Spark is for, and the
 * questions it can answer here. Each suggestion is a real button that asks the
 * question, so the first answer is one press away.
 */
export function SparkEmpty({ mayReadSales, onAsk }: SparkEmptyProps) {
  const { t } = useTranslation("directions-spark");
  const suggestions = [
    { kind: "stock", icon: Package, show: true },
    { kind: "trend", icon: TrendingUp, show: mayReadSales },
  ] as const;
  return (
    <BlurFade className="flex flex-col gap-4 px-5 pb-4 text-center">
      <div className="flex flex-col gap-2">
        <h3 className="fs-16 font-semibold text-foreground">
          {t("empty.title")}
        </h3>
        <p className="fs-14 mx-auto max-w-[34ch] text-muted-foreground">
          {t("empty.intro")}
        </p>
      </div>
      <div
        role="group"
        aria-label={t("empty.suggestions")}
        className="flex flex-col gap-2 text-left"
      >
        {suggestions
          .filter((suggestion) => suggestion.show)
          .map(({ kind, icon: Icon }) => (
            <button
              key={kind}
              type="button"
              onClick={() => {
                onAsk(t(`empty.${kind}`), kind);
              }}
              className="spark-suggestion group fs-14 flex min-h-11 items-center gap-3 border border-border bg-card px-3 py-2.5 text-left text-foreground outline-none transition-colors hover:border-ring focus-visible:ring-2 focus-visible:ring-ring"
              style={{ borderRadius: "var(--radius-card)" }}
            >
              <Icon aria-hidden="true" className="size-4 shrink-0 text-ring" />
              <span className="min-w-0 flex-1">{t(`empty.${kind}`)}</span>
              <ArrowUpRight
                aria-hidden="true"
                className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
              />
            </button>
          ))}
      </div>
    </BlurFade>
  );
}
