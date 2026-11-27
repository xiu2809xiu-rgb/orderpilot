import {
  type CheckDocumentRef,
  type CheckException,
  type CheckFieldResult,
  type CheckLineResult,
  type CheckMismatch,
  type CheckResult,
  type DocumentType,
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

/** The Checks tab's own group for the three checks against Business Central's master data. */
const BC_GROUP = "business-central-verification";

/** A failed check's own chip: how many lines differ, not what kind of line it is. */
function mismatchCountLabel(count: number): string {
  return `${String(count)} mismatch${count === 1 ? "" : "es"}`;
}

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

/** The document of this type on the order's file, if it has come. */
function documentOf(
  order: SampleOrder,
  type: OrderDocument["type"],
): OrderDocument | undefined {
  return order.documents.find((d) => d.type === type);
}

/** What a document cross-check's title and table columns call each document type. */
const DOC_LABEL: Record<DocumentType, { label: string; shortLabel: string }> = {
  CUSTOMER_PO: { label: "Customer PO", shortLabel: "PO" },
  PROFORMA_INVOICE: { label: "Proforma Invoice", shortLabel: "PI" },
  VENDOR_PI: { label: "Vendor PI", shortLabel: "Vendor PI" },
  VENDOR_INVOICE: { label: "Vendor Invoice", shortLabel: "Vendor Inv." },
  SALES_INVOICE: { label: "Sales Invoice", shortLabel: "SI" },
  CREDIT_NOTE: { label: "Credit Note", shortLabel: "CN" },
  PACKING_LIST: { label: "Packing List", shortLabel: "PL" },
  DELIVERY_ORDER: { label: "Delivery Order", shortLabel: "DO" },
  AWB: { label: "Air Waybill", shortLabel: "AWB" },
  BILL_OF_LADING: { label: "Bill of Lading", shortLabel: "BL" },
  IMPORT_PERMIT: { label: "Import Permit", shortLabel: "Permit" },
  PAYMENT_ADVICE: { label: "Payment Advice", shortLabel: "Advice" },
  SPR_FORM: { label: "SPR Form", shortLabel: "SPR" },
  OTHER: { label: "Document", shortLabel: "Doc" },
};

/** The reference a document cross-check's title and table use for one side of its pair. */
function docRef(type: DocumentType, number: string | null): CheckDocumentRef {
  return { type, number, ...DOC_LABEL[type] };
}

/** How many item lines a document carries, and the label the summary line uses for them. */
function itemSummary(order: SampleOrder): string {
  const count = order.lines.filter((line) => line.type === "Item").length;
  return `${String(count)} Item${count === 1 ? "" : "s"}`;
}

/**
 * The PO's own lines against the Proforma Invoice's, item for item. A PI
 * reprints the PO's price unless `mismatch` names the one line it drafted at
 * another price.
 */
function comparePiLines(
  order: SampleOrder,
  mismatch: { itemNo: string; piPrice: string } | null,
): CheckLineResult[] {
  return order.lines
    .filter((line) => line.type === "Item")
    .map((line) => {
      const piPrice =
        line.no === mismatch?.itemNo ? mismatch.piPrice : line.unitPrice;
      const matched = Number(piPrice) === Number(line.unitPrice);
      return {
        fromItemNo: line.no,
        fromDescription: line.description,
        fromQuantity: plainQuantity(line.quantity),
        fromPrice: line.unitPrice,
        toItemNo: line.no,
        toDescription: line.description,
        toQuantity: plainQuantity(line.quantity),
        toPrice: piPrice,
        matched,
        action: matched ? null : "Revise PI",
      };
    });
}

/**
 * The PO's own lines against the Packing List's, item for item. A packing
 * list repeats the PO's quantity unless `mismatch` names the one line packed
 * to another count.
 */
function comparePlLines(
  order: SampleOrder,
  mismatch: { itemNo: string; packed: string } | null,
): CheckLineResult[] {
  return order.lines
    .filter((line) => line.type === "Item")
    .map((line) => {
      const packed =
        line.no === mismatch?.itemNo ? mismatch.packed : line.quantityShipped;
      const matched = Number(packed) === Number(line.quantity);
      return {
        fromItemNo: line.no,
        fromDescription: line.description,
        fromQuantity: plainQuantity(line.quantity),
        fromPrice: null,
        toItemNo: line.no,
        toDescription: line.description,
        toQuantity: plainQuantity(packed),
        toPrice: null,
        matched,
        action: matched ? null : "Notify Warehouse",
      };
    });
}

/**
 * Every unmatched line of a document cross-check's table, named the way the
 * title's mismatch line names one: the two sides' own value, whichever field
 * differs (price, then quantity, then the item itself), and a short note. A
 * check with more than one unmatched line gets one of these for each, so the
 * title lists every mismatch, not only the first.
 */
function mismatchesFromLines(
  lines: readonly CheckLineResult[],
  fromRef: CheckDocumentRef,
  toRef: CheckDocumentRef,
): CheckMismatch[] {
  return lines
    .filter((line) => !line.matched)
    .map((line) => {
      const priceDiffers =
        line.toPrice !== null &&
        Number(line.toPrice) !== Number(line.fromPrice);
      const quantityDiffers =
        line.toQuantity !== null &&
        Number(line.toQuantity) !== Number(line.fromQuantity);
      if (priceDiffers) {
        return {
          fromLabel: fromRef.shortLabel,
          fromValue: line.fromPrice ?? "",
          toLabel: toRef.shortLabel,
          toValue: line.toPrice ?? "",
          note: `${line.fromItemNo} unit price variance`,
          unit: "money" as const,
        };
      }
      if (quantityDiffers) {
        return {
          fromLabel: fromRef.shortLabel,
          fromValue: line.fromQuantity ?? "",
          toLabel: toRef.shortLabel,
          toValue: line.toQuantity ?? "",
          note: `${line.fromItemNo} quantity variance`,
          unit: "plain" as const,
        };
      }
      return {
        fromLabel: fromRef.shortLabel,
        fromValue: line.fromItemNo,
        toLabel: toRef.shortLabel,
        toValue: line.toItemNo,
        note: `${line.fromItemNo} item variance`,
        unit: "plain" as const,
      };
    });
}

/**
 * The PI's own lines, with no second set of amounts to compare: the dataset
 * carries no line items for a posted sales invoice, only that it exists.
 * Every line is its own amount against itself, so the check can only ever
 * pass; area 3's engine replaces this once the invoice's own lines are read.
 */
function compareInvoiceLines(order: SampleOrder): CheckLineResult[] {
  return order.lines
    .filter((line) => line.type === "Item")
    .map((line) => ({
      fromItemNo: line.no,
      fromDescription: line.description,
      fromQuantity: null,
      fromPrice: line.lineAmount,
      toItemNo: line.no,
      toDescription: line.description,
      toQuantity: null,
      toPrice: line.lineAmount,
      matched: true,
      action: null,
    }));
}

/**
 * The packing list against the shipping document, field by field rather than
 * item by item: the units it carries, who it ships to and where, and the
 * customer's own PO number. The dataset keeps no carton count, so only the
 * units are compared; the consignee and the PO number are the order's own
 * single record, so they can only ever match. Area 3's engine replaces this
 * once the shipping document's own fields are read, cartons included.
 */
function compareShippingFields(order: SampleOrder): CheckFieldResult[] {
  const { shipped } = lineTotals(order);
  const destination = `${order.shipTo.name} (${order.shipTo.city})`;
  return [
    {
      label: "Total units",
      fromValue: `${shipped} units`,
      toValue: `${shipped} units`,
      matched: true,
      action: null,
    },
    {
      label: "Consignee & destination",
      fromValue: destination,
      toValue: destination,
      matched: true,
      action: null,
    },
    {
      label: "Reference PO",
      fromValue: order.header.externalDocumentNo,
      toValue: order.header.externalDocumentNo,
      matched: true,
      action: null,
    },
  ];
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

/** A side of a Business Central verification check that is the system itself, not a document. */
function bcRef(label: string, shortLabel: string): CheckDocumentRef {
  return { type: "BUSINESS_CENTRAL", label, shortLabel, number: null };
}

/**
 * The customer's own name, account standing and payment terms as the PO
 * prints them against Business Central's record of the same customer
 * number. Credit standing is a real comparison, the order's own total
 * against the customer's credit limit less its balance; the other two
 * fields have nothing in the sample data to vary them, so they can only
 * ever match.
 */
function customerRecordCheck(
  order: SampleOrder,
  customer: Customer | undefined,
  checkedAt: string,
): CheckResult | null {
  if (!customer) return null;
  const no = order.header.no;
  const printedName = customer.name.toUpperCase();
  const overLimit =
    Number(customer.balanceLcy) + Number(order.total) >
    Number(customer.creditLimitLcy);
  const terms =
    Number(order.header.prepaymentPercent) > 0
      ? `${order.header.prepaymentPercent}% prepayment`
      : customer.paymentTermsCode;
  const fields: CheckFieldResult[] = [
    {
      label: "Customer Name",
      fromValue: printedName,
      toValue: customer.name,
      matched: true,
      action: null,
    },
    {
      label: "Account & Credit Standing",
      fromValue: `${customer.no} \u00b7 USD ${order.total}`,
      toValue: `${customer.no} \u00b7 ${overLimit ? "Over limit" : "Active (Within limit)"}`,
      matched: !overLimit,
      action: overLimit ? "Hold for Finance" : null,
    },
    {
      label: "Payment Terms",
      fromValue: terms,
      toValue: terms,
      matched: true,
      action: null,
    },
  ];
  const failed = fields.some((field) => !field.matched);
  const pair = {
    from: { ...bcRef("Customer Record", "PO"), number: customer.no },
    to: bcRef("Business Central", "BC"),
  };
  return {
    id: `mock-${no}-customer-record`,
    ruleId: "mock.bc.customer-record",
    ruleLabel: "Customer Record against Business Central (sample result)",
    orderNo: no,
    outcome: failed ? "fail" : "pass",
    statusLabel: failed ? "Over limit" : undefined,
    chipKind: failed ? "destructive" : "success",
    group: BC_GROUP,
    pair,
    summary: failed ? undefined : `${customer.name} \u00b7 ${terms}`,
    mismatches: failed
      ? [
          {
            fromLabel: "PO",
            fromValue: `${customer.no} \u00b7 USD ${order.total}`,
            toLabel: "BC",
            toValue: "Over limit",
            note: `${customer.no} exceeds its credit limit`,
            unit: "plain" as const,
          },
        ]
      : undefined,
    fields,
    fieldColumns: {
      label: "Field",
      from: `On ${order.header.externalDocumentNo}`,
      to: "In Business Central",
    },
    expected: customer.name,
    actual: printedName,
    tolerance: { label: "Exact match on the number", value: "0" },
    evidence: [
      {
        documentId: `${no}-customer-po`,
        documentType: "CUSTOMER_PO",
        location: "header: sell-to customer",
        value: customer.no,
      },
    ],
    checkedAt,
  };
}

/**
 * Every item line's own unit price, as agreed with this customer, against
 * the item's catalogue price in Business Central. The dataset's own
 * negotiated price runs 8 percent under the catalogue price to 6 percent
 * over it, so the two are almost never the same figure: the line is out of
 * catalogue exactly when they differ, with no tolerance to call a different
 * price a match.
 */
function itemCatalogCheck(
  order: SampleOrder,
  items: readonly Item[],
  checkedAt: string,
): CheckResult | null {
  const no = order.header.no;
  const itemLines = order.lines.filter(
    (orderLine) => orderLine.type === "Item",
  );
  if (itemLines.length === 0) return null;
  const lines: CheckLineResult[] = itemLines.map((orderLine) => {
    const item = items.find((candidate) => candidate.no === orderLine.no);
    const catalogPrice = item?.unitPrice ?? orderLine.unitPrice;
    const matched = Number(catalogPrice) === Number(orderLine.unitPrice);
    return {
      fromItemNo: orderLine.no,
      fromDescription: orderLine.description,
      fromQuantity: null,
      fromPrice: orderLine.unitPrice,
      toItemNo: orderLine.no,
      toDescription: orderLine.description,
      toQuantity: null,
      toPrice: catalogPrice,
      matched,
      action: matched ? null : "Apply BC Price",
    };
  });
  const failed = lines.some((checkLine) => !checkLine.matched);
  const pair = {
    from: bcRef("Item Catalog & Unit Pricing", "PO"),
    to: bcRef("Business Central", "BC"),
  };
  const mismatches = failed
    ? mismatchesFromLines(lines, pair.from, pair.to)
    : undefined;
  return {
    id: `mock-${no}-item-catalog`,
    ruleId: "mock.bc.item-catalog",
    ruleLabel:
      "Item Catalog and Unit Pricing against Business Central (sample result)",
    orderNo: no,
    outcome: failed ? "fail" : "pass",
    statusLabel: mismatches ? mismatchCountLabel(mismatches.length) : undefined,
    chipKind: failed ? "warning" : "success",
    group: BC_GROUP,
    pair,
    summary: failed
      ? undefined
      : `${itemSummary(order)} \u00b7 Catalog & prices matched`,
    mismatches,
    lines,
    lineValue: "price",
    expected: order.total,
    actual: order.total,
    tolerance: {
      label: "Price difference in USD (sample value)",
      value: "0.00",
    },
    evidence: itemLines.map((orderLine) => ({
      documentId: `${no}-customer-po`,
      documentType: "CUSTOMER_PO",
      location: `item ${orderLine.no}: unit price`,
      value: orderLine.unitPrice,
    })),
    checkedAt,
  };
}

/**
 * Every item line's quantity against the item's own inventory in Business
 * Central: can what is on hand cover what the order wants. The sample
 * dataset's own short-stock scenario is the one case where it cannot.
 */
function liveInventoryCheck(
  order: SampleOrder,
  items: readonly Item[],
  checkedAt: string,
): CheckResult | null {
  const no = order.header.no;
  const itemLines = order.lines.filter(
    (orderLine) => orderLine.type === "Item",
  );
  if (itemLines.length === 0) return null;
  const rows = itemLines.map((orderLine) => {
    const item = items.find((candidate) => candidate.no === orderLine.no);
    const ordered = Number(orderLine.quantity);
    const onHand = item ? Number(item.inventory) : ordered;
    return {
      itemNo: orderLine.no,
      description: orderLine.description,
      ordered,
      onHand,
      matched: onHand >= ordered,
    };
  });
  const fields: CheckFieldResult[] = rows.map((row) => ({
    label: row.description,
    itemNo: row.itemNo,
    fromValue: plainQuantity(String(row.ordered)),
    toValue: plainQuantity(String(row.onHand)),
    matched: row.matched,
    action: row.matched ? null : "Raise PR",
    // "Match" says nothing about what was checked; "Covered" says the stock
    // on hand is enough for what the order wants.
    resultLabel: row.matched ? "Covered" : null,
  }));
  const failed = rows.some((row) => !row.matched);
  const mismatches: CheckMismatch[] = rows
    .filter((row) => !row.matched)
    .map((row) => ({
      fromLabel: "Ordered",
      fromValue: plainQuantity(String(row.ordered)),
      toLabel: "On hand",
      toValue: `${plainQuantity(String(row.onHand))} (${String(row.onHand - row.ordered)})`,
      note: `${row.itemNo} shortfall`,
      unit: "plain" as const,
    }));
  const { ordered } = lineTotals(order);
  const pair = {
    from: bcRef("Live Inventory Availability", "Ordered"),
    to: bcRef("Business Central", "On hand"),
  };
  return {
    id: `mock-${no}-live-inventory`,
    ruleId: "mock.bc.live-inventory",
    ruleLabel:
      "Live Inventory Availability against Business Central (sample result)",
    orderNo: no,
    outcome: failed ? "fail" : "pass",
    statusLabel: failed ? "Shortage" : undefined,
    chipKind: failed ? "warning" : "success",
    group: BC_GROUP,
    pair,
    summary: failed ? undefined : `${ordered} units \u00b7 All lines covered`,
    mismatches: failed ? mismatches : undefined,
    fields,
    fieldColumns: { label: "Item", from: "Ordered", to: "On Hand in BC" },
    expected: ordered,
    actual: ordered,
    tolerance: {
      label: "Available stock at least the quantity ordered",
      value: "0",
    },
    evidence: itemLines.map((orderLine) => ({
      documentId: `${no}-customer-po`,
      documentType: "CUSTOMER_PO",
      location: `item ${orderLine.no}: quantity`,
      value: orderLine.quantity,
    })),
    checkedAt,
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
 *
 * Ahead of them, the three Business Central verification checks: the
 * customer record, the item catalogue and unit pricing, and live inventory
 * availability, each against Business Central's own master data.
 */
export function mockChecks(
  order: SampleOrder,
  asOf: string,
  customers: readonly Customer[],
  items: readonly Item[],
): CheckResult[] {
  const no = order.header.no;
  const index = SAMPLE_STEPS.findIndex(
    (entry) => entry.state === order.sampleScreenState,
  );
  const checkedAt = stepTime(order, Math.max(index, 0), index + 1, asOf);
  const results: CheckResult[] = [];

  const customer = customers.find(
    (candidate) => candidate.no === order.header.sellToCustomerNo,
  );
  for (const check of [
    customerRecordCheck(order, customer, checkedAt),
    itemCatalogCheck(order, items, checkedAt),
    liveInventoryCheck(order, items, checkedAt),
  ]) {
    if (check) results.push(check);
  }

  const GROUP = "document-cross-check";
  const poRef = docRef("CUSTOMER_PO", order.header.externalDocumentNo);

  // 1. Customer PO against Proforma Invoice.
  const piDoc = documentOf(order, "PROFORMA_INVOICE");
  if (piDoc) {
    const mismatch =
      order.scenario.kind === "pi-price-mismatch" ? order.scenario : null;
    const lines = comparePiLines(order, mismatch);
    const failed = lines.some((line) => !line.matched);
    const poPiPair = {
      from: poRef,
      to: docRef("PROFORMA_INVOICE", piDoc.number),
    };
    const poPiMismatches = failed
      ? mismatchesFromLines(lines, poPiPair.from, poPiPair.to)
      : undefined;
    results.push({
      id: `mock-${no}-po-pi`,
      ruleId: "mock.doc.po-pi",
      ruleLabel: "Customer PO against Proforma Invoice (sample result)",
      orderNo: no,
      outcome: failed ? "fail" : "pass",
      statusLabel: poPiMismatches
        ? mismatchCountLabel(poPiMismatches.length)
        : undefined,
      chipKind: failed ? "warning" : "success",
      group: GROUP,
      pair: poPiPair,
      summary: failed
        ? undefined
        : `${order.header.currencyCode} ${order.total} \u00b7 ${itemSummary(order)}`,
      mismatches: poPiMismatches,
      lines,
      expected: mismatch ? mismatch.poPrice : order.total,
      actual: mismatch ? mismatch.piPrice : order.total,
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
          documentId: piDoc.id,
          documentType: "PROFORMA_INVOICE",
          location: "header: total",
          value: order.total,
        },
      ],
      checkedAt,
    });
  }

  // 2. Customer PO against Packing List.
  const plDoc = documentOf(order, "PACKING_LIST");
  if (plDoc) {
    const mismatch =
      order.scenario.kind === "packing-list-mismatch" ? order.scenario : null;
    const lines = comparePlLines(order, mismatch);
    const failed = lines.some((line) => !line.matched);
    const { ordered, shipped } = lineTotals(order);
    const poPlPair = { from: poRef, to: docRef("PACKING_LIST", plDoc.number) };
    const poPlMismatches = failed
      ? mismatchesFromLines(lines, poPlPair.from, poPlPair.to)
      : undefined;
    results.push({
      id: `mock-${no}-po-pl`,
      ruleId: "mock.doc.po-pl",
      ruleLabel: "Customer PO against Packing List (sample result)",
      orderNo: no,
      outcome: failed ? "fail" : "pass",
      statusLabel: poPlMismatches
        ? mismatchCountLabel(poPlMismatches.length)
        : undefined,
      chipKind: failed ? "warning" : "success",
      group: GROUP,
      pair: poPlPair,
      summary: failed
        ? undefined
        : `${ordered} units \u00b7 ${itemSummary(order)}`,
      mismatches: poPlMismatches,
      lines,
      expected: ordered,
      actual: mismatch ? plainQuantity(mismatch.packed) : shipped,
      tolerance: MOCK_TOLERANCE,
      evidence: [
        {
          documentId: `${no}-customer-po`,
          documentType: "CUSTOMER_PO",
          location: "lines: total quantity",
          value: ordered,
        },
        {
          documentId: plDoc.id,
          documentType: "PACKING_LIST",
          location: "lines: total quantity",
          value: shipped,
        },
      ],
      checkedAt,
    });
  }

  // 3. Proforma Invoice against Sales Invoice, on a prepaid order. Nothing in
  // the sample data mismatches this pair, so once the sales invoice is on
  // file the check passes; while it is missing the check is pending, with an
  // upload offered in its place.
  const prepaid = Number(order.header.prepaymentPercent) > 0;
  if (prepaid && piDoc) {
    const salesInvoice = documentOf(order, "SALES_INVOICE");
    const pair = {
      from: docRef("PROFORMA_INVOICE", piDoc.number),
      to: docRef("SALES_INVOICE", salesInvoice?.number ?? null),
    };
    if (salesInvoice) {
      results.push({
        id: `mock-${no}-pi-si`,
        ruleId: "mock.doc.pi-si",
        ruleLabel: "Proforma Invoice against Sales Invoice (sample result)",
        orderNo: no,
        outcome: "pass",
        chipKind: "success",
        group: GROUP,
        pair,
        summary: `${order.header.currencyCode} ${order.total} \u00b7 ${itemSummary(order)}`,
        lines: compareInvoiceLines(order),
        lineValue: "amount",
        expected: order.total,
        actual: order.total,
        tolerance: {
          label: "Price difference in USD (sample value)",
          value: "0.00",
        },
        evidence: [
          {
            documentId: piDoc.id,
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
    } else {
      results.push({
        id: `mock-${no}-pi-si`,
        ruleId: "mock.doc.pi-si",
        ruleLabel: "Proforma Invoice against Sales Invoice (sample result)",
        orderNo: no,
        outcome: "pending",
        statusLabel: "Pending copy",
        chipKind: "warning",
        group: GROUP,
        pair,
        summary: "Missing Sales Invoice file",
        upload: { label: "Upload Invoice", document: "SALES_INVOICE" },
        expected: order.total,
        actual: "",
        tolerance: {
          label: "Price difference in USD (sample value)",
          value: "0.00",
        },
        evidence: [
          {
            documentId: piDoc.id,
            documentType: "PROFORMA_INVOICE",
            location: "header: total",
            value: order.total,
          },
        ],
        checkedAt,
      });
    }
  }

  // 4. Packing List against Bill of Lading / Air Waybill. A shipping
  // document that is `expected` (overdue, never confirmed) is overdue, with
  // an upload offered in place of a result table.
  if (plDoc) {
    const shipping =
      documentOf(order, "AWB") ?? documentOf(order, "BILL_OF_LADING");
    if (shipping) {
      const pair = {
        from: docRef("PACKING_LIST", plDoc.number),
        to: docRef(
          shipping.type,
          shipping.status === "expected" ? null : shipping.number,
        ),
      };
      if (shipping.status === "expected") {
        const overdue =
          order.scenario.kind === "awb-overdue" ? order.scenario : null;
        const dueWords = shipping.dueDate ? inWords(shipping.dueDate) : null;
        const lateWords =
          overdue && dueWords
            ? `Due ${dueWords} (${String(overdue.daysOverdue)} days late)`
            : "Overdue";
        results.push({
          id: `mock-${no}-pl-awb`,
          ruleId: "mock.doc.pl-awb",
          ruleLabel:
            "Packing List against Bill of Lading / Air Waybill (sample result)",
          orderNo: no,
          outcome: "overdue",
          statusLabel: "Overdue",
          chipKind: "destructive",
          group: GROUP,
          pair,
          summary: `${lateWords} \u00b7 Missing ${pair.to.label} file`,
          upload: {
            label: `Upload ${pair.to.shortLabel}`,
            document: shipping.type,
          },
          expected: "Received",
          actual: "Missing",
          tolerance: { label: "The document is on file", value: "0" },
          evidence: [
            {
              documentId: plDoc.id,
              documentType: "PACKING_LIST",
              location: "header: shipment",
              value: "Packed",
            },
          ],
          checkedAt,
        });
      } else {
        const { ordered, shipped } = lineTotals(order);
        results.push({
          id: `mock-${no}-pl-awb`,
          ruleId: "mock.doc.pl-awb",
          ruleLabel:
            "Packing List against Bill of Lading / Air Waybill (sample result)",
          orderNo: no,
          outcome: "pass",
          chipKind: "success",
          group: GROUP,
          pair,
          summary: `${shipped} units \u00b7 ${itemSummary(order)}`,
          fields: compareShippingFields(order),
          expected: ordered,
          actual: shipped,
          tolerance: MOCK_TOLERANCE,
          evidence: [
            {
              documentId: plDoc.id,
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
