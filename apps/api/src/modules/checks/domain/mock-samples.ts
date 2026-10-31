import {
  type CheckException,
  type CheckResult,
  type MasterMatch,
  type OverdueFlag,
  type TimelineStep,
  type Tolerance,
} from "@orderpilot/shared";
import type {
  Customer,
  Item,
  SampleException,
  SampleOrder,
} from "@orderpilot/synthetic-data";
import { SAMPLE_STEPS, sampleStepFor } from "./mock-status.js";

// Mock builders for the base's screens. They read the synthetic data's sample
// scenarios and write typed results that say so (`mock.` rule ids). They hold
// no check, no tolerance logic and no overdue rule: area 3 replaces them with
// results from the engine and the tracker's read model.

export const MOCK_TOLERANCE: Tolerance = {
  label: "Quantity difference in units (sample value)",
  value: "0",
};

/** "5.00" and "25" print the same way: no trailing zero decimals. */
function plainQuantity(value: string): string {
  return value.replace(/\.0+$/, "");
}

function stepTime(order: SampleOrder, index: number): string {
  const hour = String(8 + index).padStart(2, "0");
  return `${order.header.orderDate}T${hour}:00:00.000Z`;
}

export function mockTimeline(order: SampleOrder): TimelineStep[] {
  const current = SAMPLE_STEPS.findIndex(
    (entry) => entry.state === order.sampleScreenState,
  );
  return SAMPLE_STEPS.slice(0, current + 1).map((entry, index) => ({
    id: `${order.header.no}-step-${String(index + 1)}`,
    at: stepTime(order, index),
    actor: entry.actor,
    title: entry.title,
    effect: entry.effect,
    current: index === current,
  }));
}

/**
 * Overdue as the dataset states it: the order has work waiting that fell due
 * before today. The words come from the dataset's scenario or the step. No
 * rule here decides what is late: that is the SLA logic, which is not ours.
 */
export function mockOverdue(order: SampleOrder, asOf: string): OverdueFlag {
  const { scenario } = order;
  const due = order.step.dueOn;
  if (!due || due >= asOf) {
    return { overdue: false, daysOverdue: 0, reason: null };
  }
  const days = Math.round(
    (Date.parse(`${asOf}T00:00:00Z`) - Date.parse(`${due}T00:00:00Z`)) /
      86_400_000,
  );
  if (scenario.kind === "awb-overdue") {
    const what = scenario.documentType === "AWB" ? "AWB" : "Bill of lading";
    return {
      overdue: true,
      daysOverdue: days,
      reason: `${what} was due on ${scenario.dueDate}`,
    };
  }
  return {
    overdue: true,
    daysOverdue: days,
    reason: `${sampleStepFor(order.sampleScreenState).status.label} was due on ${due}`,
  };
}

export function mockChecks(order: SampleOrder): CheckResult[] {
  const no = order.header.no;
  const index = SAMPLE_STEPS.findIndex(
    (entry) => entry.state === order.sampleScreenState,
  );
  const checkedAt = stepTime(order, Math.max(index, 0));
  const results: CheckResult[] = [];
  if (index >= 1) {
    results.push({
      id: `mock-${no}-1`,
      ruleId: "mock.sample-customer-no",
      ruleLabel: "Customer No. is in master data (sample result)",
      orderNo: no,
      outcome: "pass",
      expected: order.header.sellToCustomerNo,
      actual: order.header.sellToCustomerNo,
      tolerance: { label: "Exact match on the number", value: "0" },
      evidence: [
        {
          documentId: `${no}-customer-po`,
          documentType: "CUSTOMER_PO",
          location: "header: sell-to customer",
          value: order.header.sellToCustomerNo,
        },
      ],
      checkedAt,
    });
  }
  if (order.scenario.kind === "packing-list-mismatch") {
    const { itemNo } = order.scenario;
    const ordered = plainQuantity(order.scenario.ordered);
    const packed = plainQuantity(order.scenario.packed);
    results.push({
      id: `mock-${no}-2`,
      ruleId: "mock.sample-quantity",
      ruleLabel: "Packing list quantity against the PO (sample result)",
      orderNo: no,
      outcome: "fail",
      expected: ordered,
      actual: packed,
      tolerance: MOCK_TOLERANCE,
      evidence: [
        {
          documentId: `${no}-customer-po`,
          documentType: "CUSTOMER_PO",
          location: `item ${itemNo}: quantity`,
          value: ordered,
        },
        {
          documentId: `${no}-packing-list`,
          documentType: "PACKING_LIST",
          location: `item ${itemNo}: quantity`,
          value: packed,
        },
      ],
      checkedAt,
    });
  }
  if (order.scenario.kind === "price-mismatch") {
    const { itemNo, printed, listed } = order.scenario;
    results.push({
      id: `mock-${no}-3`,
      ruleId: "mock.sample-price",
      ruleLabel: "Unit price against the price list (sample result)",
      orderNo: no,
      outcome: "fail",
      expected: listed,
      actual: printed,
      tolerance: {
        label: "Price difference in USD (sample value)",
        value: "0.00",
      },
      evidence: [
        {
          documentId: `${no}-customer-po`,
          documentType: "CUSTOMER_PO",
          location: `item ${itemNo}: unit price`,
          value: printed,
        },
      ],
      checkedAt,
    });
  }
  return results;
}

/**
 * The dataset's exceptions in the queue's shape, with the customer's name
 * added. The dataset raises them from each order's scenario; area 3's engine
 * replaces that.
 */
export function mockExceptions(
  exceptions: readonly SampleException[],
  customers: readonly Customer[],
): CheckException[] {
  const names = new Map(customers.map((c) => [c.no, c.name]));
  return exceptions.map((e) => ({
    id: e.recordNo,
    orderNo: e.orderNo,
    customerNo: e.customerNo,
    customerName: names.get(e.customerNo) ?? e.customerNo,
    ruleId: e.ruleId,
    ruleLabel: e.ruleLabel,
    summary: e.summary,
    expected: e.expected,
    actual: e.found,
    difference: e.difference,
    tolerance: { label: e.toleranceLabel, value: e.toleranceValue },
    fixBy: e.fixBy,
    state: e.state,
    openedAt: e.openedAt,
  }));
}

/**
 * Stand-in for the possible matches: the next records in the master data
 * after the one at hand, in file order. It compares no names. Area 3 (Iok
 * Teck) decides what counts as a look-alike. A possible match is for a
 * person to look at and is never used to match.
 */
function samplePossibleMatches<T extends { no: string }>(
  records: readonly T[],
  ownNo: string,
  nameOf: (record: T) => string,
  limit: number,
): MasterMatch["possibleMatches"] {
  const at = records.findIndex((r) => r.no === ownNo);
  return records
    .filter((r) => r.no !== ownNo)
    .slice(Math.max(at, 0), Math.max(at, 0) + limit)
    .map((r) => ({ no: r.no, name: nameOf(r) }));
}

/**
 * The customer and every item line matched on their Navision numbers. The
 * printed name is shown beside the matched one and is never used to match.
 */
export function mockMatches(
  order: SampleOrder,
  customers: readonly Customer[],
  items: readonly Item[],
): MasterMatch[] {
  const customer = customers.find(
    (c) => c.no === order.header.sellToCustomerNo,
  );
  // Documents often print the name in capitals, so the demo does too.
  const printedCustomer = (
    customer?.name ?? order.header.sellToCustomerNo
  ).toUpperCase();
  const matches: MasterMatch[] = [
    {
      kind: "customer",
      printedNo: order.header.sellToCustomerNo,
      printedName: printedCustomer,
      matchedNo: customer?.no ?? null,
      matchedName: customer?.name ?? null,
      possibleMatches: samplePossibleMatches(
        customers,
        order.header.sellToCustomerNo,
        (c) => c.name,
        2,
      ),
    },
  ];
  for (const line of order.lines) {
    if (line.type !== "Item") continue;
    const item = items.find((i) => i.no === line.no);
    matches.push({
      kind: "item",
      printedNo: line.no,
      printedName: line.description,
      matchedNo: item?.no ?? null,
      matchedName: item?.description ?? null,
      possibleMatches: samplePossibleMatches(
        items,
        line.no,
        (i) => i.description,
        2,
      ),
    });
  }
  return matches;
}
