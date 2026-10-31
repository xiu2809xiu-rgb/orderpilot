import { addDecimal } from "@orderpilot/shared";
import { addDays, atHour } from "./dates.js";
import type { Journey } from "./journey.js";
import type { RecordNumberer } from "./records.js";
import type { SampleException, SampleOrder } from "./types.js";

const QUANTITY_RULE = {
  ruleId: "mock.sample-quantity",
  ruleLabel: "Packing list quantity against the PO (sample result)",
  toleranceLabel: "Quantity difference in units (sample value)",
  toleranceValue: "0",
} as const;

/** "5.00" and "25" print the same way: no trailing zero decimals. */
function plain(value: string): string {
  return value.replace(/\.0+$/, "");
}

/**
 * Exceptions follow from each order's scenario, with the expected and found
 * values the screen shows: a packing list that disagrees with the PO, a
 * shipping document that is late, a PO price that differs from the price
 * list. Some closed orders carry one that was resolved on the way. These are
 * stand-ins for area 3's engine, which decides what a check is.
 */
export function makeExceptions(
  orders: readonly SampleOrder[],
  journeys: readonly Journey[],
  numberer: RecordNumberer,
): SampleException[] {
  const rows: SampleException[] = [];
  orders.forEach((order, index) => {
    const journey = journeys[index];
    if (!journey) return;
    const base = {
      orderNo: order.header.no,
      customerNo: order.header.sellToCustomerNo,
      state: "OPEN" as const,
      resolvedAt: null,
    };
    const open = (
      when: string,
      extra: Omit<SampleException, keyof typeof base | "recordNo" | "openedAt">,
    ) =>
      rows.push({
        ...base,
        ...extra,
        recordNo: numberer.next("EXC", when),
        openedAt: atHour(when, 4 + (index % 4)),
      });
    const { scenario } = order;
    if (scenario.kind === "packing-list-mismatch") {
      const ordered = plain(scenario.ordered);
      const packed = plain(scenario.packed);
      open(journey.enteredOn, {
        ...QUANTITY_RULE,
        summary: `Item ${scenario.itemNo}: the packing list says ${packed}, the PO says ${ordered}`,
        expected: ordered,
        found: packed,
        difference: `${String(Number(ordered) - Number(packed))} units fewer than the PO`,
        fixBy: "SUPPORT",
      });
    } else if (scenario.kind === "awb-overdue") {
      const what = scenario.documentType === "AWB" ? "AWB" : "bill of lading";
      open(addDays(scenario.dueDate, 1), {
        ruleId: "mock.sample-awb-due",
        ruleLabel: "Shipping document received on time (sample result)",
        summary: `The ${what} was due on ${scenario.dueDate} and has not arrived`,
        expected: `Received by ${scenario.dueDate}`,
        found: "Not received",
        difference: `${String(scenario.daysOverdue)} days late`,
        toleranceLabel: "Days late (sample value)",
        toleranceValue: "0",
        fixBy: "LOGISTICS",
      });
    } else if (scenario.kind === "price-mismatch") {
      open(journey.enteredOn, {
        ruleId: "mock.sample-price",
        ruleLabel: "Unit price against the price list (sample result)",
        summary: `Item ${scenario.itemNo}: the PO prints ${scenario.printed}, the price list says ${scenario.listed}`,
        expected: scenario.listed,
        found: scenario.printed,
        difference: `${addDecimal(scenario.printed, `-${scenario.listed}`)} USD a unit`,
        toleranceLabel: "Price difference in USD (sample value)",
        toleranceValue: "0.00",
        fixBy: "SUPPORT",
      });
    }
    // A quantity mismatch that was put right before the goods shipped.
    const first = order.lines[0];
    const packed = journey.done.packed;
    if (
      first &&
      packed &&
      journey.state === "sample-closed" &&
      journey.indexInState % 3 === 0
    ) {
      const ordered = plain(first.quantity);
      const found = String(Number(ordered) - 1);
      const openedAt = atHour(packed, 4);
      rows.push({
        ...base,
        ...QUANTITY_RULE,
        recordNo: numberer.next("EXC", packed),
        summary: `Item ${first.no}: the packing list said ${found}, the PO says ${ordered}`,
        expected: ordered,
        found,
        difference: "1 unit fewer than the PO",
        fixBy: "SUPPORT",
        state: "RESOLVED",
        openedAt,
        resolvedAt: atHour(packed, 8),
      });
    }
  });
  return rows;
}
