import { useTranslation } from "react-i18next";
import type { StockFacts } from "../sparkFacts";
import { grouped } from "../sparkFacts";

/**
 * The stock figures behind the answer: one row per item, in the order a buyer
 * reads them (what we hold, what is promised, what is left, what is coming).
 * The part number sits under the item's name: a 420 px panel has no room for
 * six columns, and the number belongs to the item.
 * Numbers are right-aligned tabular figures. It scrolls sideways inside its
 * own box on a narrow panel, never the panel.
 */
export function StockTable({ facts }: { facts: StockFacts }) {
  const { t } = useTranslation("directions-spark");
  return (
    <div
      className="overflow-x-auto border border-border"
      style={{ borderRadius: "var(--radius-card)" }}
    >
      <table className="fs-13 w-full border-collapse">
        <caption className="sr-only">{t("stock.table")}</caption>
        <thead>
          <tr className="border-b border-border text-muted-foreground">
            <th
              scope="col"
              className="fs-12 px-2 py-2 pl-3 text-left font-medium"
            >
              {t("stock.columns.itemPart")}
            </th>
            {(["onHand", "sales", "available", "po"] as const).map((key) => (
              <th
                key={key}
                scope="col"
                className="fs-12 px-2 py-2 text-right font-medium last:pr-3"
              >
                {t(`stock.columns.${key}`)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {facts.items.map((item) => (
            <tr
              key={item.itemNo}
              className="border-b border-border last:border-b-0"
            >
              <th
                scope="row"
                className="px-2 py-2 pl-3 text-left font-medium text-foreground"
              >
                {item.description}
                <span className="numeral fs-12 block font-normal text-muted-foreground">
                  {item.partNumber}
                </span>
              </th>
              <td className="numeral px-2 py-2 text-right">
                {grouped(item.onHand)}
              </td>
              <td className="numeral px-2 py-2 text-right">
                {grouped(item.onSalesOrders)}
              </td>
              <td className="numeral px-2 py-2 text-right font-semibold text-foreground">
                {grouped(item.available)}
              </td>
              <td className="numeral px-2 py-2 pr-3 text-right">
                {grouped(item.onPurchaseOrders)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
