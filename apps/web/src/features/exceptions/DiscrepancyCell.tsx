import type { CheckException } from "@orderpilot/shared";
import { Badge } from "@/components/ui/badge";
import { formatDay } from "@/lib/format";
import { checkLabelOf } from "./checkLabels";

/** An item's own number, such as "I-0074", read out of a summary sentence. */
const ITEM_NO_PATTERN = /\b([A-Z]{1,3}-\d{2,})\b/;

/** "$92.28" from "92.28": every amount here is in USD. */
function money(value: string): string {
  return value.startsWith("$") ? value : `$${value}`;
}

/**
 * Splits a summary written as "<subject>: <detail>", such as
 * "Item I-0074: the packing list says 18, the PO says 20". A summary with no
 * colon has no detail line of its own, so the whole sentence is the subject.
 */
function splitSummary(summary: string): { subject: string; detail: string } {
  const colon = summary.indexOf(":");
  if (colon === -1) return { subject: summary, detail: "" };
  return {
    subject: summary.slice(0, colon).trim(),
    detail: summary.slice(colon + 1).trim(),
  };
}

/**
 * The left side of the discrepancy cell: the subject (an item's number, or
 * the shipping document) on its own line, and the exact comparison, in the
 * check's own wording, under it. A rule this does not recognise falls back
 * to splitting the summary sentence on its first colon, so a new check still
 * shows something sensible before its own formatting is added here.
 */
function subjectAndDetailOf(
  row: CheckException,
  expectedLabel: string,
  actualLabel: string,
): { subject: string; detail: string } {
  const check = checkLabelOf(row.ruleLabel);
  if (check === "AWB / BL upload deadline") {
    return {
      subject: "Bill of lading",
      detail: `Due ${formatDay(row.expected)}`,
    };
  }
  const itemNo = ITEM_NO_PATTERN.exec(row.summary)?.[1];
  const subject = itemNo ? `Item ${itemNo}` : splitSummary(row.summary).subject;
  if (check === "PL vs PO") {
    return { subject, detail: `PL: ${row.actual} \u00b7 PO: ${row.expected}` };
  }
  if (check === "PI vs PO") {
    return {
      subject,
      detail: `PI: ${money(row.actual)} \u00b7 PO: ${money(row.expected)}`,
    };
  }
  const { subject: fallbackSubject, detail } = splitSummary(row.summary);
  return {
    subject: fallbackSubject,
    detail:
      detail ||
      `${expectedLabel}: ${row.expected} \u00b7 ${actualLabel}: ${row.actual}`,
  };
}

/**
 * The unit a tolerance measures in, read from its label's own parenthetical,
 * such as "units" from "Quantity difference (units)". A label with none
 * gives no unit, and the variance is shown on its own.
 */
function unitOf(toleranceLabel: string): string | null {
  const match = /\(([^)]+)\)\s*$/.exec(toleranceLabel);
  return match ? match[1].trim() : null;
}

/** A unit stays plural for every count but one, where its trailing "s" drops. */
function pluralize(unit: string, amount: number): string {
  if (Math.abs(amount) !== 1 || !unit.endsWith("s")) return unit;
  return unit.slice(0, -1);
}

/**
 * Drops a trailing "than the PO" (or "than the PO's quantity", and the
 * like): the comparison line right above the pill already names the PO, so
 * the pill itself only needs the count and its direction.
 */
function shortenVariance(text: string): string {
  return text.replace(/\s+than the po\b.*$/i, "").trim();
}

/**
 * The variance pill's own short text: "2 units fewer" for a numeric
 * difference whose tolerance names a unit, and the difference as given for
 * everything else, such as "2 days late" or "+$1.50 / unit", which already
 * come worded that way.
 */
function varianceOf(row: CheckException): string {
  const amount = Number(row.difference);
  if (!Number.isFinite(amount)) return shortenVariance(row.difference);
  const unit = unitOf(row.tolerance.label);
  if (!unit) return shortenVariance(row.difference);
  const absolute = Math.abs(amount);
  const count = String(absolute);
  return `${count} ${pluralize(unit, absolute)} ${amount < 0 ? "fewer" : "more"}`;
}

/**
 * The exceptions queue's merged discrepancy cell: what differs and the exact
 * comparison on the left, the variance as a short monospace pill on the
 * right, right-aligned within the cell.
 */
export function DiscrepancyCell({
  row,
  expectedLabel,
  actualLabel,
}: {
  row: CheckException;
  expectedLabel: string;
  actualLabel: string;
}) {
  const { subject, detail } = subjectAndDetailOf(
    row,
    expectedLabel,
    actualLabel,
  );

  return (
    <div className="flex w-full items-center gap-s3">
      <div className="min-w-0">
        <p className="truncate font-bold text-foreground">{subject}</p>
        <p className="truncate text-xs text-muted-foreground">{detail}</p>
      </div>
      <Badge
        variant="outline"
        className="ml-auto shrink-0 font-mono tabular-nums"
      >
        {varianceOf(row)}
      </Badge>
    </div>
  );
}
