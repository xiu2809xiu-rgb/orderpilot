import {
  addDecimal,
  multiplyDecimal,
  type CheckException,
  type CheckResult,
  type MasterMatch,
  type OverdueFlag,
  type TimelineStep,
  type Tolerance,
} from "@orderpilot/shared";
import type { Customer, Item, SampleOrder } from "@orderpilot/synthetic-data";
import { lookAlikes } from "./name-match.js";
import { SAMPLE_STEPS } from "./mock-status.js";

// Mock builders for the base's screens. They read the synthetic data's sample
// scenarios and write typed results that say so (`mock.` rule ids). They hold
// no check, no tolerance logic and no overdue rule: area 3 replaces them with
// results from the engine and the tracker's read model.

export const MOCK_TOLERANCE: Tolerance = {
  label: "Quantity difference in units (sample value)",
  value: "0",
};

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

export function mockOverdue(order: SampleOrder): OverdueFlag {
  const { scenario } = order;
  if (scenario.kind !== "awb-overdue") {
    return { overdue: false, daysOverdue: 0, reason: null };
  }
  const what = scenario.documentType === "AWB" ? "AWB" : "Bill of lading";
  return {
    overdue: true,
    daysOverdue: scenario.daysOverdue,
    reason: `${what} was due on ${scenario.dueDate}`,
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
    const { ordered, packed, itemNo } = order.scenario;
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
  return results;
}

/** One sample exception for each sample scenario that would raise one. */
export function mockExceptions(
  orders: readonly SampleOrder[],
  customers: readonly Customer[],
): CheckException[] {
  const rows: CheckException[] = [];
  for (const order of orders) {
    const customer = customers.find(
      (c) => c.no === order.header.sellToCustomerNo,
    );
    const index = SAMPLE_STEPS.findIndex(
      (entry) => entry.state === order.sampleScreenState,
    );
    const base = {
      id: `mock-exception-${order.header.no}`,
      orderNo: order.header.no,
      customerNo: order.header.sellToCustomerNo,
      customerName: customer?.name ?? order.header.sellToCustomerNo,
      state: "OPEN" as const,
      openedAt: stepTime(order, Math.max(index, 0)),
    };
    const { scenario } = order;
    if (scenario.kind === "packing-list-mismatch") {
      rows.push({
        ...base,
        ruleId: "mock.sample-quantity",
        ruleLabel: "Packing list quantity against the PO (sample result)",
        summary: `Item ${scenario.itemNo}: the packing list says ${scenario.packed}, the PO says ${scenario.ordered}`,
        expected: scenario.ordered,
        actual: scenario.packed,
        difference: addDecimal(
          scenario.packed,
          multiplyDecimal(scenario.ordered, "-1"),
        ),
        tolerance: MOCK_TOLERANCE,
        fixBy: "SUPPORT",
      });
    } else if (scenario.kind === "awb-overdue") {
      rows.push({
        ...base,
        ruleId: "mock.sample-awb-due",
        ruleLabel: "Shipping document received on time (sample result)",
        summary: `The ${scenario.documentType === "AWB" ? "AWB" : "bill of lading"} was due on ${scenario.dueDate} and has not arrived`,
        expected: `Received by ${scenario.dueDate}`,
        actual: "Not received",
        difference: `${String(scenario.daysOverdue)} days late`,
        tolerance: { label: "Days late (sample value)", value: "0" },
        fixBy: "LOGISTICS",
      });
    }
  }
  return rows;
}

/**
 * The customer and every item line matched on their Navision numbers. The
 * printed name is shown beside the matched one and is never used to match.
 * Records with a similar name but another number are listed as possible
 * matches, for a person to look at.
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
      possibleMatches: lookAlikes(
        printedCustomer,
        customers.map((c) => ({ no: c.no, name: c.name })),
        order.header.sellToCustomerNo,
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
      possibleMatches: lookAlikes(
        line.description,
        items.map((i) => ({ no: i.no, name: i.description })),
        line.no,
        { limit: 2 },
      ),
    });
  }
  return matches;
}
