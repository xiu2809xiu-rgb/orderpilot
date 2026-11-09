import {
  isDecimalString,
  isLineAmountTooLarge,
  lineAmount,
  sumDecimal,
  type CreateSalesOrderBody,
  type FieldIssue,
} from "@orderpilot/shared";
import { ValidationFailedError } from "../../../common/domain-error.js";
import type { OrderFactsLine } from "./order-facts.js";

/** What master data knows of an item that a line starts from. */
export interface DraftItem {
  readonly description: string;
  readonly unitPrice: string;
}

export interface DraftLineContext {
  readonly items: ReadonlyMap<string, DraftItem>;
  /** False for a role that sees no prices: it never sends one and never resets one. */
  readonly canSeePrice: boolean;
  /** The lines already saved, so a masked writer's negotiated price survives an edit. */
  readonly stored: readonly OrderFactsLine[];
}

/**
 * Turns the lines of a request into the lines a draft holds. The grid is
 * zero-based and `SalesOrderLine` numbers from 1, so every complaint is raised
 * here, with the grid's index, before the domain class can raise one with the
 * other.
 *
 * `qtyToShip` starts at the quantity: master data counts a line as open from
 * what is left to ship, and a zero would hide a submitted order's demand.
 */
export function draftLines(
  body: Pick<CreateSalesOrderBody, "lines">,
  context: DraftLineContext,
): OrderFactsLine[] {
  const issues: FieldIssue[] = [];
  const lines = body.lines.map((line, index): OrderFactsLine => {
    const at = `lines.${String(index)}`;
    const item = context.items.get(line.itemNo);
    if (!item)
      issues.push({
        path: `${at}.itemNo`,
        message: "No item has this Business Central number.",
      });
    const unitPrice = priceOf(
      line.unitPrice,
      index,
      line.itemNo,
      context,
      (m) => issues.push({ path: `${at}.unitPrice`, message: m }),
    );
    if (isLineAmountTooLarge(line.quantity, unitPrice))
      issues.push({
        path: `${at}.quantity`,
        message: "The amount of this line is too large to hold.",
      });
    return {
      lineNo: index + 1,
      itemNo: line.itemNo,
      description:
        nonBlank(line.description) ?? item?.description ?? line.itemNo,
      quantity: line.quantity,
      unitPrice,
      qtyToShip: line.quantity,
    };
  });
  // Each line fits, but 200 of them can sum past what a decimal string holds,
  // and the list's amount sort and filter must never meet a total they cannot compare.
  if (issues.length === 0 && !isTotalHoldable(lines))
    issues.push({ path: "lines", message: TOTAL_TOO_LARGE });
  if (issues.length > 0) throw new ValidationFailedError(issues);
  return lines;
}

/** The words used when the sum of the lines is too large, here and in the domain class. */
export const TOTAL_TOO_LARGE = "The total of these lines is too large to hold.";

/** True when the sum of the line amounts is still a decimal string. */
export function isTotalHoldable(
  lines: readonly Pick<OrderFactsLine, "quantity" | "unitPrice">[],
): boolean {
  const amounts = lines.map((l) => lineAmount(l.quantity, l.unitPrice) ?? "0");
  return isDecimalString(sumDecimal(amounts));
}

/**
 * The price of a line. The customer's PO sets it (ADR 0047), so master data's
 * list price is never a fallback: a role that sees no prices keeps only the
 * price already stored on the same position and item, and a line it adds or
 * changes needs a role that sees prices to type it.
 */
function priceOf(
  sent: string | undefined,
  index: number,
  itemNo: string,
  context: DraftLineContext,
  refuse: (message: string) => void,
): string {
  if (context.canSeePrice) {
    if (sent === undefined) refuse("Give the price of this line.");
    return sent ?? "0";
  }
  if (sent !== undefined) {
    refuse("Your role does not set prices.");
    return "0";
  }
  // By position as well as item: two lines of one item may hold two agreed prices.
  const kept = context.stored.find(
    (line) => line.lineNo === index + 1 && line.itemNo === itemNo,
  );
  if (!kept)
    refuse("Ask a role that sees prices to enter the price from the PO.");
  return kept?.unitPrice ?? "0";
}

const nonBlank = (value: string | undefined): string | undefined =>
  value === undefined || value === "" ? undefined : value;
