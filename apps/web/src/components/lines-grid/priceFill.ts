import { normaliseDecimal } from "@/components/form";
import type { LastPrice, LineValue, PriceFrom } from "./types";

/** What a line's price becomes, with where it came from. */
export interface PriceFill {
  unitPrice: string;
  priceFrom: PriceFrom;
}

/**
 * The item's list price as the line holds it, or "" when the answer masks it
 * or has none: a masked price is never written, so it cannot reach a draft.
 */
export function listPrice(
  price: { masked: boolean; value: string | null } | undefined,
): string {
  if (!price || price.masked || price.value === null) return "";
  return normaliseDecimal(price.value, 2);
}

/**
 * The price a line has once its item is chosen: the item's list price. A
 * price the person typed for this same item, or before any item was chosen, is
 * kept: choosing the same item again must never take back what was typed.
 */
export function priceForPick(
  line: Pick<LineValue, "priceFrom" | "unitPrice"> | undefined,
  itemNo: string,
  list: string,
): PriceFill {
  const from = line?.priceFrom;
  if (
    from?.source === "typed" &&
    (from.itemNo === "" || from.itemNo === itemNo)
  ) {
    return {
      unitPrice: line?.unitPrice ?? "",
      priceFrom: { source: "typed", itemNo, list },
    };
  }
  return {
    unitPrice: list,
    priceFrom: { source: "item", itemNo, list },
  };
}

/** The line's price once the person typed in it. */
export function typedPrice(
  line: Pick<LineValue, "item" | "priceFrom"> | undefined,
): PriceFrom {
  return {
    source: "typed",
    itemNo: line?.item?.number ?? "",
    list: line?.priceFrom?.list ?? "",
  };
}

/**
 * Swaps in what the customer last agreed to pay once that is known, and puts
 * the list price back if the customer has none. Only a price the grid itself
 * filled is touched: a typed price, and a saved line's, are the person's.
 * Null means no change.
 */
export function priceForCustomer(
  line: Pick<LineValue, "item" | "priceFrom" | "unitPrice">,
  agreed: LastPrice | "none" | "unknown" | null,
): PriceFill | null {
  const from = line.priceFrom;
  const item = line.item?.number;
  if (!from || from.source === "typed" || from.itemNo !== item) return null;
  // A failed lookup says nothing about the customer: what is there stays.
  if (agreed === "unknown") return null;
  if (typeof agreed === "object" && agreed !== null) {
    const price = normaliseDecimal(agreed.price, 2);
    return from.source === "agreed" && line.unitPrice === price
      ? null
      : { unitPrice: price, priceFrom: { ...from, source: "agreed" } };
  }
  if (from.source !== "agreed") return null;
  return {
    unitPrice: from.list,
    priceFrom: { ...from, source: "item" },
  };
}
