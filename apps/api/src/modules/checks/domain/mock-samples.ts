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
  OrderDocument,
  SampleException,
  SampleOrder,
  SampleScreenState,
} from "@orderpilot/synthetic-data";
import { SAMPLE_STEPS, sampleStepFor, type SampleStep } from "./mock-status.js";

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

const DAY_MS = 86_400_000;

/**
 * When the step at `index` of `count` happened: spread from the order date
 * to the dataset's day, from 9 am Singapore time, a quarter of an hour apart
 * within a day. No step lands in the future, and steps keep their order.
 */
function stepTime(
  order: SampleOrder,
  index: number,
  count: number,
  asOf: string,
): string {
  const start = Date.parse(`${order.header.orderDate}T01:00:00Z`);
  const end = Math.max(start, Date.parse(`${asOf}T01:00:00Z`));
  const days = Math.floor((end - start) / DAY_MS);
  const day = count > 1 ? Math.floor((index * days) / (count - 1)) : 0;
  return new Date(start + day * DAY_MS + index * 900_000).toISOString();
}

const DAY_WORDS = new Intl.DateTimeFormat("en-SG", {
  dateStyle: "medium",
  timeZone: "UTC",
});

/** "2026-11-04" as "4 Nov 2026", the way every screen writes a date. */
function inWords(day: string): string {
  return DAY_WORDS.format(new Date(`${day}T00:00:00Z`));
}

/**
 * On credit terms nothing is paid before the goods go, so the steps that say
 * so elsewhere read differently. Only the words change, for one mock timeline.
 */
const ON_CREDIT: Partial<Record<SampleScreenState, Partial<SampleStep>>> = {
  "sample-awaiting-payment": {
    effect: "No prepayment on these terms: payment follows the invoice",
  },
  "sample-ready-to-pick": {
    actor: "System",
    title: "Released for packing",
    effect: "Credit terms: the warehouse can pick before payment",
  },
  "sample-closed": { title: "Payment received" },
};

/**
 * With a balance still to come, the payment that released packing was a
 * deposit or a prepayment. Calling it "Payment confirmed" would contradict the
 * order page, which still has the balance to confirm.
 */
function partPayment(percent: number): Partial<SampleStep> {
  const word = percent === 30 ? "Deposit" : "Prepayment";
  return {
    title: `${word} confirmed`,
    effect: `${word} confirmed: packing released, the warehouse can pick. A balance is still to come`,
  };
}

/** A packing list check the order has passed found nothing to hold it up. */
const PACKING_PASSED: Partial<SampleStep> = {
  effect: "The packing list matches the PO, so the goods can ship",
};

export function mockTimeline(order: SampleOrder, asOf: string): TimelineStep[] {
  const current = SAMPLE_STEPS.findIndex(
    (entry) => entry.state === order.sampleScreenState,
  );
  const percent = Number(order.header.prepaymentPercent);
  const credit = percent === 0;
  const partPaid = percent > 0 && percent < 100;
  return SAMPLE_STEPS.slice(0, current + 1).map((step, index) => {
    const entry = {
      ...step,
      ...(credit ? ON_CREDIT[step.state] : {}),
      ...(partPaid && step.state === "sample-ready-to-pick"
        ? partPayment(percent)
        : {}),
      ...(step.state === "sample-packing-list-mismatch" && index < current
        ? PACKING_PASSED
        : {}),
    };
    return {
      id: `${order.header.no}-step-${String(index + 1)}`,
      at: stepTime(order, index, current + 1, asOf),
      actor: entry.actor,
      title: entry.title,
      effect: entry.effect,
      current: index === current,
    };
  });
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
      reason: `${what} was due on ${inWords(scenario.dueDate)}`,
    };
  }
  return {
    overdue: true,
    daysOverdue: days,
    reason: `${sampleStepFor(order.sampleScreenState).status.label} was due on ${inWords(due)}`,
  };
}

/** True once the order has a document of this type on file, draft or final. */
function hasDocument(order: SampleOrder, type: OrderDocument["type"]): boolean {
  return order.documents.some((d) => d.type === type);
}

/** The document of this type on the order's file, if it has come. */
function documentOf(
  order: SampleOrder,
  type: OrderDocument["type"],
): OrderDocument | undefined {
  return order.documents.find((d) => d.type === type);
}

/** Ordered and shipped, summed over the item lines. */
function lineTotals(order: SampleOrder): {
  ordered: string;
  shipped: string;
} {
  let ordered = 0;
  let shipped = 0;
  for (const line of order.lines) {
    if (line.type !== "Item") continue;
    ordered += Number(line.quantity);
    shipped += Number(line.quantityShipped);
  }
  return {
    ordered: plainQuantity(String(ordered)),
    shipped: plainQuantity(String(shipped)),
  };
}

/**
 * Area 3's four document cross-checks, each run only once both documents of
 * its pair are on the order's file: the customer PO against the proforma
 * invoice, the PO against the packing list, the proforma invoice against the
 * sales invoice (on a prepaid order, once Business Central has posted one),
 * and the packing list against the bill of lading or air waybill. A pair
 * whose second document has not come, and is not yet overdue, runs no check:
 * there is nothing yet to compare it against.
 */
export function mockChecks(order: SampleOrder, asOf: string): CheckResult[] {
  const no = order.header.no;
  const index = SAMPLE_STEPS.findIndex(
    (entry) => entry.state === order.sampleScreenState,
  );
  const checkedAt = stepTime(order, Math.max(index, 0), index + 1, asOf);
  const results: CheckResult[] = [];

  if (index >= 1) {
    results.push({
      id: `mock-${no}-customer-no`,
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

  // 1. Customer PO against Proforma Invoice.
  if (hasDocument(order, "PROFORMA_INVOICE")) {
    if (order.scenario.kind === "pi-price-mismatch") {
      const { itemNo, poPrice, piPrice } = order.scenario;
      results.push({
        id: `mock-${no}-po-pi`,
        ruleId: "mock.doc.po-pi",
        ruleLabel: "Customer PO against Proforma Invoice (sample result)",
        orderNo: no,
        outcome: "fail",
        expected: poPrice,
        actual: piPrice,
        tolerance: {
          label: "Price difference in USD (sample value)",
          value: "0.00",
        },
        evidence: [
          {
            documentId: `${no}-customer-po`,
            documentType: "CUSTOMER_PO",
            location: `item ${itemNo}: unit price`,
            value: poPrice,
          },
          {
            documentId: `${no}-proforma-invoice`,
            documentType: "PROFORMA_INVOICE",
            location: `item ${itemNo}: unit price`,
            value: piPrice,
          },
        ],
        checkedAt,
      });
    } else {
      results.push({
        id: `mock-${no}-po-pi`,
        ruleId: "mock.doc.po-pi",
        ruleLabel: "Customer PO against Proforma Invoice (sample result)",
        orderNo: no,
        outcome: "pass",
        expected: order.total,
        actual: order.total,
        tolerance: {
          label: "Price difference in USD (sample value)",
          value: "0.00",
        },
        evidence: [
          {
            documentId: `${no}-customer-po`,
            documentType: "CUSTOMER_PO",
            location: "header: total",
            value: order.total,
          },
          {
            documentId: `${no}-proforma-invoice`,
            documentType: "PROFORMA_INVOICE",
            location: "header: total",
            value: order.total,
          },
        ],
        checkedAt,
      });
    }
  }

  // 2. Customer PO against Packing List.
  if (hasDocument(order, "PACKING_LIST")) {
    if (order.scenario.kind === "packing-list-mismatch") {
      const { itemNo } = order.scenario;
      const ordered = plainQuantity(order.scenario.ordered);
      const packed = plainQuantity(order.scenario.packed);
      results.push({
        id: `mock-${no}-po-pl`,
        ruleId: "mock.doc.po-pl",
        ruleLabel: "Customer PO against Packing List (sample result)",
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
    } else {
      const { ordered, shipped } = lineTotals(order);
      results.push({
        id: `mock-${no}-po-pl`,
        ruleId: "mock.doc.po-pl",
        ruleLabel: "Customer PO against Packing List (sample result)",
        orderNo: no,
        outcome: "pass",
        expected: ordered,
        actual: shipped,
        tolerance: MOCK_TOLERANCE,
        evidence: [
          {
            documentId: `${no}-customer-po`,
            documentType: "CUSTOMER_PO",
            location: "lines: total quantity",
            value: ordered,
          },
          {
            documentId: `${no}-packing-list`,
            documentType: "PACKING_LIST",
            location: "lines: total quantity",
            value: shipped,
          },
        ],
        checkedAt,
      });
    }
  }

  // 3. Proforma Invoice against Sales Invoice, on a prepaid order once
  // Business Central has posted one. Nothing in the sample data mismatches
  // this pair, so once the sales invoice is on file the check passes.
  const prepaid = Number(order.header.prepaymentPercent) > 0;
  if (prepaid && hasDocument(order, "PROFORMA_INVOICE")) {
    const salesInvoice = documentOf(order, "SALES_INVOICE");
    if (salesInvoice) {
      results.push({
        id: `mock-${no}-pi-si`,
        ruleId: "mock.doc.pi-si",
        ruleLabel: "Proforma Invoice against Sales Invoice (sample result)",
        orderNo: no,
        outcome: "pass",
        expected: order.total,
        actual: order.total,
        tolerance: {
          label: "Price difference in USD (sample value)",
          value: "0.00",
        },
        evidence: [
          {
            documentId: `${no}-proforma-invoice`,
            documentType: "PROFORMA_INVOICE",
            location: "header: total",
            value: order.total,
          },
          {
            documentId: salesInvoice.id,
            documentType: "SALES_INVOICE",
            location: "header: total",
            value: order.total,
          },
        ],
        checkedAt,
      });
    }
  }

  // 4. Packing List against Bill of Lading / Air Waybill. A shipping
  // document that is `expected` (overdue, never confirmed) fails the check:
  // nothing confirms the packing list went out as it reads.
  if (hasDocument(order, "PACKING_LIST")) {
    const shipping =
      documentOf(order, "AWB") ?? documentOf(order, "BILL_OF_LADING");
    if (shipping?.status === "expected") {
      results.push({
        id: `mock-${no}-pl-awb`,
        ruleId: "mock.doc.pl-awb",
        ruleLabel:
          "Packing List against Bill of Lading / Air Waybill (sample result)",
        orderNo: no,
        outcome: "fail",
        expected: "Received",
        actual: shipping.dueDate
          ? `Missing, due ${shipping.dueDate}`
          : "Missing",
        tolerance: { label: "The document is on file", value: "0" },
        evidence: [
          {
            documentId: `${no}-packing-list`,
            documentType: "PACKING_LIST",
            location: "header: shipment",
            value: "Packed",
          },
          {
            documentId: shipping.id,
            documentType: shipping.type,
            location: "header: status",
            value: "Expected",
          },
        ],
        checkedAt,
      });
    } else if (shipping) {
      const { ordered, shipped } = lineTotals(order);
      results.push({
        id: `mock-${no}-pl-awb`,
        ruleId: "mock.doc.pl-awb",
        ruleLabel:
          "Packing List against Bill of Lading / Air Waybill (sample result)",
        orderNo: no,
        outcome: "pass",
        expected: ordered,
        actual: shipped,
        tolerance: MOCK_TOLERANCE,
        evidence: [
          {
            documentId: `${no}-packing-list`,
            documentType: "PACKING_LIST",
            location: "lines: total quantity",
            value: ordered,
          },
          {
            documentId: shipping.id,
            documentType: shipping.type,
            location: "lines: total quantity",
            value: shipped,
          },
        ],
        checkedAt,
      });
    }
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
 * Stand-in for the possible matches: other records whose name starts with the
 * same word (a brand, or a company's first name), nearest in the master data
 * first. A crude look-alike so the demo shows sensible pairs; the real rule is
 * area 3's to set. A possible match is for a person to look at and is never
 * used to match.
 */
function samplePossibleMatches<T extends { no: string }>(
  records: readonly T[],
  ownNo: string,
  nameOf: (record: T) => string,
  limit: number,
): MasterMatch["possibleMatches"] {
  const at = Math.max(
    records.findIndex((r) => r.no === ownNo),
    0,
  );
  const own = records[at];
  const word = own ? firstWord(nameOf(own)) : "";
  return records
    .map((record, index) => ({ record, distance: Math.abs(index - at) }))
    .filter(
      ({ record }) =>
        record.no !== ownNo &&
        word !== "" &&
        firstWord(nameOf(record)) === word,
    )
    .sort((a, b) => a.distance - b.distance)
    .slice(0, limit)
    .map(({ record }) => ({ no: record.no, name: nameOf(record) }));
}

function firstWord(name: string): string {
  return (name.trim().split(/\s+/)[0] ?? "").toLowerCase();
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
