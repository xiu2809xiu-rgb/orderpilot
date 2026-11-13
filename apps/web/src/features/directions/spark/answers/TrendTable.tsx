import { useTranslation } from "react-i18next";
import { millions, monthName, type TrendFacts } from "../sparkFacts";

/** The chart's figures as a table, for anyone who would rather read them. */
export function TrendTable({ facts }: { facts: TrendFacts }) {
  const { t } = useTranslation("directions-spark");
  return (
    <div
      className="max-h-56 overflow-auto border border-border"
      style={{ borderRadius: "var(--radius-card)" }}
    >
      <table className="fs-13 w-full border-collapse">
        <caption className="sr-only">{t("trend.table")}</caption>
        <thead className="sticky top-0 bg-card text-muted-foreground">
          <tr className="border-b border-border">
            <th scope="col" className="fs-12 px-3 py-2 text-left font-medium">
              {t("trend.columns.month")}
            </th>
            <th scope="col" className="fs-12 px-2 py-2 text-right font-medium">
              {t("trend.columns.amount")}
            </th>
            <th scope="col" className="fs-12 px-2 py-2 text-left font-medium">
              {t("trend.columns.kind")}
            </th>
            <th scope="col" className="fs-12 px-3 py-2 text-right font-medium">
              {t("trend.columns.range")}
            </th>
          </tr>
        </thead>
        <tbody>
          {facts.points.map((point) => (
            <tr
              key={point.month}
              className="border-b border-border last:border-b-0"
            >
              <th
                scope="row"
                className="numeral px-3 py-1.5 text-left font-normal"
              >
                {`${monthName(point.month)} ${point.month.slice(0, 4)}`}
              </th>
              <td className="numeral px-2 py-1.5 text-right">
                {millions(point.amountUsd)}
              </td>
              <td className="px-2 py-1.5 text-muted-foreground">
                {t(point.forecast ? "trend.kind.forecast" : "trend.kind.seen")}
              </td>
              <td className="numeral px-3 py-1.5 text-right text-muted-foreground">
                {point.range
                  ? t("trend.rangeValue", {
                      low: millions(point.range.low),
                      high: millions(point.range.high),
                    })
                  : ""}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
