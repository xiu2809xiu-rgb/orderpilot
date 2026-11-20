import { useEffect, useRef } from "react";
import { useFormState, useWatch } from "react-hook-form";
import { priceForCustomer } from "@/components/lines-grid";
import { useMasterDataLastPrices } from "@/lib/api/generated/endpoints/master-data/master-data";
import {
  setLinePrices,
  type LinePrice,
  type OrderForm,
} from "./orderFormValues";

/** How often a failed lookup is asked again; the interval `LineAvailability` uses. */
const REFRESH_MS = 30_000;

/**
 * Keeps what the order's customer last paid beside each line. It draws
 * nothing, like `LineAvailability`, so a lookup re-renders only this leaf and
 * never the lines being typed in. The price is written to the line's
 * `lastPrice` as context. A line whose price the grid filled (the item's list
 * price) takes the agreed price instead, because what a customer agreed to pay
 * is a better start than the list; a price the person typed never changes.
 *
 * A failed lookup is shown as "not known" and asked again by itself, so the
 * person is never left guessing whether there is no price or none was read.
 *
 * A role that sees no prices never asks, so no request is made and no
 * price reaches the form.
 */
export function LineLastPrice({
  form,
  priceMasked,
  paused,
}: {
  form: OrderForm;
  priceMasked: boolean;
  /** A void order needs no context. */
  paused: boolean;
}) {
  const lines = useWatch({ control: form.control, name: "lines" });
  const customer = useWatch({ control: form.control, name: "customer" });
  const { isSubmitting } = useFormState({ control: form.control });
  const customerNo = customer?.number ?? "";
  const itemNos = [
    ...new Set(lines.flatMap((line) => (line.item ? [line.item.number] : []))),
  ]
    .sort()
    .join(",");
  // The item on each line, in order: a swap for an item already asked about
  // changes no query, but its line still needs the price written again.
  const lineItems = lines.map((line) => line.item?.number ?? "").join(",");
  // A pick can put a fresh list price on a line whose item did not change, and
  // the agreed price is then due again, so the price sources count too.
  const lineSources = lines
    .map(
      (line) => `${line.priceFrom?.source ?? "-"}${line.lastPrice ? "+" : "-"}`,
    )
    .join(",");
  const asking = customerNo !== "" && itemNos !== "" && !priceMasked && !paused;
  const prices = useMasterDataLastPrices(
    customerNo,
    { itemNos },
    {
      query: {
        enabled: asking,
        refetchInterval: (query) =>
          query.state.status === "error" ? REFRESH_MS : false,
      },
    },
  );
  // The customer whose prices are on the lines now. When another customer is
  // picked, the old customer's prices must go at once: they are not the new
  // customer's, and the new answer may take a while.
  const shownFor = useRef(customerNo);
  const answer = prices.data;
  const failed = prices.isError;

  useEffect(() => {
    if (priceMasked) {
      // No prices are on the lines for a masked role, so nothing is stale.
      shownFor.current = customerNo;
      return;
    }
    if (isSubmitting) return;
    // Waiting for an answer for these items: leave what is there.
    if (asking && !answer && !failed) {
      if (shownFor.current !== customerNo) {
        const cleared: LinePrice[] = [];
        form.getValues("lines").forEach((line, index) => {
          if (
            line.item &&
            line.lastPrice !== null &&
            line.lastPrice !== undefined
          ) {
            cleared.push({ index, itemNo: line.item.number, lastPrice: null });
          }
        });
        setLinePrices(form, cleared);
        shownFor.current = customerNo;
      }
      return;
    }
    const byItem = new Map(
      asking && answer && !failed
        ? answer.data.map((entry) => [entry.itemNo, entry])
        : [],
    );
    const writes: LinePrice[] = [];
    const fills: {
      index: number;
      fill: NonNullable<ReturnType<typeof priceForCustomer>>;
    }[] = [];
    form.getValues("lines").forEach((line, index) => {
      if (!line.item) return;
      const found = byItem.get(line.item.number);
      const value = found?.price.value;
      const next: LinePrice["lastPrice"] = !asking
        ? null
        : failed
          ? "unknown"
          : !found
            ? "none"
            : typeof value === "string"
              ? {
                  price: value,
                  agreedOn: found.agreedOn,
                  documentNo: found.documentNo,
                }
              : null;
      const fill = priceForCustomer(line, next);
      if (fill) fills.push({ index, fill });
      const current = line.lastPrice ?? null;
      const same =
        typeof next === "object" && next !== null
          ? typeof current === "object" &&
            current !== null &&
            current.price === next.price &&
            current.agreedOn === next.agreedOn &&
            current.documentNo === next.documentNo
          : current === next;
      if (same) return;
      writes.push({ index, itemNo: line.item.number, lastPrice: next });
    });
    setLinePrices(form, writes);
    for (const { index, fill } of fills) {
      const at = `lines.${String(index)}` as `lines.${number}`;
      form.setValue(`${at}.unitPrice`, fill.unitPrice, { shouldDirty: true });
      form.setValue(`${at}.priceFrom`, fill.priceFrom);
    }
    shownFor.current = customerNo;
  }, [
    answer,
    failed,
    asking,
    priceMasked,
    isSubmitting,
    lineItems,
    lineSources,
    customerNo,
    form,
  ]);

  return null;
}
