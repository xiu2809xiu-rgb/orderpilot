import type { PoVersionDifferences } from "@orderpilot/shared";
import { useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { ScrollRegion } from "@/components/common";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import "@/features/directions/screens/orders/orders.css";
import { countsText, onlyMoved } from "./differenceText";
import { DifferenceRow } from "./DifferenceRow";
import { HeaderDifferences } from "./HeaderDifferences";

/**
 * What differs between two PO versions: the header first, field by field, then
 * the lines that differ, with the item and its status before the numbers so that
 * the meaning is not the column that scrolls off a narrow screen. The tab draws
 * every line; the panel (`compact`) draws only the lines that differ and offers
 * the rest. A role whose prices are masked is always told that prices are not
 * compared, and never that they are the same.
 */
export function PoDifferences({
  differences,
  currency,
  compact = false,
  liveCounts = true,
}: {
  differences: PoVersionDifferences;
  currency: string;
  compact?: boolean;
  /** False where the page announces the counts in its own words. */
  liveCounts?: boolean;
}) {
  const { t } = useTranslation("directions-orders");
  const tableId = useId();
  const [all, setAll] = useState(false);
  const { pricesCompared } = differences;
  const quiet = (line: PoVersionDifferences["lines"][number]) =>
    line.status === "unchanged" && !line.moved;
  const hidden = compact && !all ? differences.lines.filter(quiet).length : 0;
  const shown =
    compact && !all
      ? differences.lines.filter((line) => !quiet(line))
      : differences.lines;
  return (
    <div className="space-y-s2">
      {pricesCompared ? null : (
        <p className="fs-14 max-w-prose text-muted-foreground">
          {t("order.versions.pricesNotCompared")}
        </p>
      )}
      <HeaderDifferences differences={differences} currency={currency} />
      {differences.identical ? (
        <p className="fs-14 max-w-prose">
          {t(
            pricesCompared
              ? "order.versions.identical"
              : "order.versions.identicalMasked",
            {
              from: differences.fromPoVersionNo,
              to: differences.toPoVersionNo,
            },
          )}
        </p>
      ) : (
        <>
          {onlyMoved(differences) ? (
            <p className="fs-14 max-w-prose">{t("order.versions.onlyMoved")}</p>
          ) : null}
          <ScrollRegion label={t("order.versions.region")}>
            {/* The orders list cuts a long item name short; here the name wraps, or the longest one on the page would push the status off a phone before the person has read it. */}
            <Table
              id={tableId}
              className="od-table od-lines [&_.od-customer-name]:whitespace-normal"
            >
              <caption className="sr-only">
                {t("order.versions.caption")}
              </caption>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead scope="col">
                    {t("order.versions.col.item")}
                  </TableHead>
                  <TableHead scope="col">
                    {t("order.versions.col.status")}
                  </TableHead>
                  <TableHead scope="col" className="text-right">
                    {t("order.versions.col.quantity")}
                  </TableHead>
                  <TableHead scope="col" className="text-right">
                    {t("order.versions.col.unitPrice")}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {shown.map((line) => (
                  <DifferenceRow
                    key={`${line.itemNo}-${String(line.fromLineNo)}-${String(line.toLineNo)}`}
                    line={line}
                    currency={currency}
                    pricesCompared={pricesCompared}
                  />
                ))}
              </TableBody>
            </Table>
          </ScrollRegion>
        </>
      )}
      {compact && !differences.identical && (hidden > 0 || all) ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="pointer-coarse:h-11"
          aria-expanded={all}
          aria-controls={tableId}
          onClick={() => {
            setAll(!all);
          }}
        >
          {all
            ? t("order.versions.hideUnchanged")
            : t("order.versions.showUnchanged", { count: hidden })}
        </Button>
      ) : null}
      <p
        className="fs-14 text-muted-foreground"
        {...(liveCounts ? { role: "status" } : {})}
      >
        {countsText(t, differences)}
      </p>
    </div>
  );
}
