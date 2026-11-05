import {
  isDecimalString,
  lineAmount,
  shortfallOf,
  sumDecimal,
} from "@orderpilot/shared";
import type { LineTotals, LineValue, PriceMask, Shortfall } from "./types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

/** The lines of a form, read safely: a form value is untrusted until narrowed. */
export function readLines(value: unknown): Partial<LineValue>[] {
  if (!Array.isArray(value)) return [];
  return value.map((entry: unknown) => {
    if (!isRecord(entry)) return {};
    const item = entry.item;
    return {
      lineId: text(entry.lineId),
      item:
        isRecord(item) && typeof item.number === "string"
          ? { number: item.number, name: text(item.name) }
          : null,
      quantity: text(entry.quantity),
      unitPrice: text(entry.unitPrice),
      availableStock:
        typeof entry.availableStock === "string" ? entry.availableStock : null,
    };
  });
}

/** A line's amount: quantity times unit price, or null until both are numbers. */
export function amountOfLine(
  line: Pick<LineValue, "quantity" | "unitPrice">,
): string | null {
  return lineAmount(line.quantity, line.unitPrice);
}

/**
 * The footer's figures, from decimal strings only. `masked` hides the amount:
 * a total of masked prices would give them away.
 */
export function totalsOf(
  lines: readonly Partial<LineValue>[],
  options: { hasAmount: boolean; masked: PriceMask | null },
): LineTotals {
  const quantities = lines
    .map((line) => line.quantity ?? "")
    .filter(isDecimalString);
  const amounts = lines.flatMap((line) => {
    const amount = amountOfLine({
      quantity: line.quantity ?? "",
      unitPrice: line.unitPrice ?? "",
    });
    return amount === null ? [] : [amount];
  });
  const showsAmount = options.hasAmount && options.masked === null;
  return {
    lineCount: lines.length,
    quantity: sumDecimal(quantities),
    amount: showsAmount ? sumDecimal(amounts) : null,
    masked: options.hasAmount ? options.masked : null,
    fromServer: false,
  };
}

/**
 * What a line is short by, or null. Judged on this line alone: the API's
 * available stock already counts every saved order, and the web never works
 * that formula out again.
 */
export function shortfallOfLine(
  line: Partial<LineValue>,
  index: number,
): Shortfall | null {
  if (
    !line.item ||
    line.availableStock === null ||
    line.availableStock === undefined
  )
    return null;
  const shortBy = shortfallOf(line.quantity ?? "", line.availableStock);
  if (shortBy === null) return null;
  return {
    index,
    lineId: line.lineId ?? "",
    itemNo: line.item.number,
    needed: line.quantity ?? "",
    available: line.availableStock,
    shortBy,
  };
}
