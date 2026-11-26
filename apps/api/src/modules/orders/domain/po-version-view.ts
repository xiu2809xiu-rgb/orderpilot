import type {
  LineDifferenceView,
  PoVersionDifferences,
  PriceDifference,
  Role,
} from "@orderpilot/shared";
import type { OrderMasking } from "./order-masking.js";
import type { NumberedPoVersionContent } from "./po-version-content.js";
import { PoVersionDiff, type LineDifference } from "./po-version-diff.js";

/**
 * The only place a price becomes a masked object (ADR 0074 decision 9). It
 * builds the differences itself, from two contents and the role, so a caller
 * cannot hand it a diff that was built for a role that sees prices. A role that
 * may not see them gets an object with no `from`, no `to` and no `changed`, and
 * a line's status, `identical` and the counts come from what it may see.
 */
export function toDifferencesView(
  from: NumberedPoVersionContent,
  to: NumberedPoVersionContent,
  masking: OrderMasking,
  role: Role,
): PoVersionDifferences {
  const diff = PoVersionDiff.between(from, to, {
    comparePrices: masking.canSeeAmount(role),
  });
  const maskedPrice = (): PriceDifference => {
    const field = masking.amount(role, "0");
    return {
      masked: true,
      field: field.field,
      classification: field.classification,
      reason: field.reason ?? "price",
    };
  };
  const price = (shown: {
    from: string | null;
    to: string | null;
    changed: boolean;
  }): PriceDifference =>
    diff.pricesCompared ? { masked: false, ...shown } : maskedPrice();
  return {
    fromPoVersionNo: diff.fromPoVersionNo,
    toPoVersionNo: diff.toPoVersionNo,
    identical: diff.identical,
    pricesCompared: diff.pricesCompared,
    header: diff.header.map((field) => ({ ...field })),
    total: price(diff.total),
    lines: diff.lines.map((line): LineDifferenceView => lineView(line, price)),
    counts: diff.counts,
  };
}

function lineView(
  line: LineDifference,
  price: (shown: {
    from: string | null;
    to: string | null;
    changed: boolean;
  }) => PriceDifference,
): LineDifferenceView {
  return {
    status: line.status,
    itemNo: line.itemNo,
    description: line.description,
    fromLineNo: line.from?.lineNo ?? null,
    toLineNo: line.to?.lineNo ?? null,
    moved: line.moved,
    quantity: {
      from: line.from?.quantity ?? null,
      to: line.to?.quantity ?? null,
      changed: line.quantityChanged,
    },
    unitPrice: price({
      from: line.from?.unitPrice ?? null,
      to: line.to?.unitPrice ?? null,
      changed: line.priceChanged,
    }),
  };
}
