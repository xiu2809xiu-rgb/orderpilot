import { useTranslation } from "react-i18next";
import { formatDay } from "@/lib/format";
import { Amount } from "./Amount";
import { DocsCell } from "./OrderFigures";
import type { OrderRow } from "./orderRow";

/**
 * The facts of the columns this window has no room for, written under the
 * order's number in the column's own order: the PO number, the team that holds
 * the order, the ship date, the value and the documents. The value is the same
 * masked-or-shown amount as its column, so a role that may not see prices does
 * not see one here either.
 */
export function FoldedFacts({
  row,
  ids,
  roleLabel,
}: {
  row: OrderRow;
  ids: readonly string[];
  roleLabel: (role: NonNullable<OrderRow["ownerRole"]>) => string;
}) {
  const { t } = useTranslation("directions-orders");
  if (ids.length === 0) return null;
  return (
    <span className="od-folded fs-12 text-muted-foreground">
      {ids.map((id) => {
        switch (id) {
          case "externalDocumentNo":
            return (
              <span key={id} className="numeral">
                <span className="sr-only">{t("cells.poFact")} </span>
                {row.externalDocumentNo}
              </span>
            );
          case "heldAt":
            return row.ownerRole ? (
              <span key={id}>
                {t("cells.heldAtFact", { team: roleLabel(row.ownerRole) })}
              </span>
            ) : null;
          case "shipmentDate":
            return row.shipmentDate ? (
              <span key={id}>
                {t("cells.shipFact", { date: formatDay(row.shipmentDate) })}
              </span>
            ) : null;
          case "amount":
            return (
              <Amount key={id} field={row.amount} currency={row.currencyCode} />
            );
          case "docs":
            return <DocsCell key={id} row={row} />;
          default:
            return null;
        }
      })}
    </span>
  );
}
