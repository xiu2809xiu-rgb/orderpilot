import { ChartColumn, Table2 } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { millions, type TrendFacts } from "../sparkFacts";
import { TrendChart } from "./TrendChart";
import { TrendTable } from "./TrendTable";

/** The words of the trend answer, from the data. */
export function trendSentence(
  t: (key: string, options?: Record<string, unknown>) => string,
  facts: TrendFacts,
): string {
  return t("trend.answer", {
    last: millions(facts.last12),
    prior: millions(facts.prior12),
    forecast: millions(facts.forecastTotal),
    change: Math.abs(facts.change * 100).toFixed(1),
    direction: t(facts.change >= 0 ? "trend.higher" : "trend.lower"),
  });
}

/**
 * The chart under the trend sentence, with its table view, the method in one
 * line, and "Open in dashboard", which leads to the insights screen of the
 * preview. Until that screen is built there is no button, only a plain note:
 * a control that leads nowhere is not offered.
 */
export function TrendAnswerParts({ facts }: { facts: TrendFacts }) {
  const { t } = useTranslation("directions-spark");
  const [asTable, setAsTable] = useState(false);
  return (
    <div className="flex flex-col gap-3">
      {asTable ? (
        <TrendTable facts={facts} />
      ) : (
        <div className="flex flex-col gap-1">
          <p className="fs-12 text-muted-foreground">{t("trend.unit")}</p>
          <TrendChart facts={facts} />
        </div>
      )}
      <p className="fs-14 text-muted-foreground">
        {t("trend.method", { method: facts.method })}
      </p>
      <p className="fs-12 text-muted-foreground">{t("trend.source")}</p>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="ghost"
          aria-pressed={asTable}
          onClick={() => {
            setAsTable((value) => !value);
          }}
          className="pointer-coarse:h-11"
        >
          {asTable ? (
            <ChartColumn aria-hidden="true" />
          ) : (
            <Table2 aria-hidden="true" />
          )}
          {t(asTable ? "trend.showChart" : "trend.showTable")}
        </Button>
      </div>
    </div>
  );
}
