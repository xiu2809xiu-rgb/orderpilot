import { useTranslation } from "react-i18next";
import { MaskedValue, Money } from "@/components/common";
import { formatQuantity } from "@/lib/format";
import type { LineTotals } from "./types";

/** The default footer: how many lines, how many units, and what they come to. */
export function LinesFooter({ totals }: { totals: LineTotals }) {
  const { t } = useTranslation("linesGrid");
  return (
    <dl className="flex flex-wrap items-baseline justify-end gap-x-s4 gap-y-1 text-sm">
      <div className="flex gap-1">
        <dt className="text-muted-foreground">{t("footer.lines")}</dt>
        <dd className="tabular-nums">{totals.lineCount}</dd>
      </div>
      <div className="flex gap-1">
        <dt className="text-muted-foreground">{t("footer.quantity")}</dt>
        <dd className="tabular-nums">{formatQuantity(totals.quantity)}</dd>
      </div>
      {totals.amount === null && totals.masked === null ? null : (
        <div className="flex items-center gap-1 font-medium">
          <dt>{t("footer.total")}</dt>
          <dd className="tabular-nums">
            {totals.masked ? (
              <MaskedValue
                masked
                reason={totals.masked.reason}
                visibleTo={totals.masked.visibleTo}
              />
            ) : (
              <Money value={totals.amount ?? "0.00"} />
            )}
          </dd>
        </div>
      )}
    </dl>
  );
}
