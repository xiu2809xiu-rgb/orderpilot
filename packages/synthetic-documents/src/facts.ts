import { addDecimal, multiplyDecimal } from "@orderpilot/shared";
import type {
  Customer,
  Item,
  SampleOrder,
  SyntheticDataset,
} from "@orderpilot/synthetic-data";
import {
  CONTACTS,
  CREDIT_DAYS,
  TERMS,
  layoutForCustomer,
} from "./facts-data.js";
import type {
  BaseFacts,
  Due,
  FactLine,
  Figures,
  Totals,
} from "./facts-base.js";
import { linesOf, plantedOf } from "./facts-lines.js";
import { toCents, trimDecimal } from "./format.js";
import { LEGACY_KINDS, type LegacyKind, type LegacyLayout } from "./model.js";
import { datesOf, find, numberOf, pinned } from "./pinned.js";
import {
  SELLER,
  SELLER_BANK,
  billTo,
  portOf,
  shipTo,
  type BankDetails,
  type Party,
} from "./parties.js";

export type { FactLine } from "./facts-base.js";

export interface DocumentFacts extends BaseFacts {
  kind: LegacyKind;
  layout: LegacyLayout;
  orderNo: string;
  customerNo: string;
  /** The document's own number: the PO's, the PI's, the packing list's or the invoice's. */
  number: string;
  /** The required date on a PO, the validity of a PI, the due date of an invoice. */
  otherDate: string | null;
  /** The customer's PO number, which every later document quotes. */
  poNumber: string;
  seller: Party;
  buyer: Party;
  shipTo: Party;
  contact: string;
  incoterms: string;
  paymentTerms: string;
  totals: Totals;
  due: Due | null;
  bank: BankDetails | null;
}

/**
 * What a PI asks for now, to the cent. Rounded here, half up, because a
 * printed amount has two decimals and the figure a customer pays must be the
 * one on the page.
 */
function dueNow(total: string, percent: string): Due {
  const amount = toCents(
    multiplyDecimal(total, (Number(percent) / 100).toFixed(4)),
  );
  return { percent, amount, balance: addDecimal(total, `-${amount}`) };
}

function sum(values: readonly string[]): string {
  return values.reduce((total, value) => addDecimal(total, value), "0");
}

function figuresOf(
  lines: FactLine[],
  kind: LegacyKind,
  percent: string,
): Figures {
  const amount = sum(lines.map((l) => l.amount));
  return {
    lines,
    totals: {
      amount,
      quantity: trimDecimal(sum(lines.map((l) => l.quantity))),
      cartons: trimDecimal(sum(lines.map((l) => l.cartons))),
      grossKg: lines.reduce((s, l) => s + Number(l.grossKg), 0).toFixed(1),
    },
    due:
      kind === "PROFORMA_INVOICE" && Number(percent) > 0
        ? dueNow(amount, percent)
        : null,
  };
}

/**
 * Everything a document prints, worked out once from the records it hangs on.
 * `anchor` is the same order on the fixed reference date, and carries the
 * dates and dated numbers. The order need not be in any dataset: a long order
 * is its own anchor.
 */
export function factsFor(
  order: SampleOrder,
  anchor: SampleOrder,
  customer: Customer,
  itemOf: (no: string) => Item,
  kind: LegacyKind,
): DocumentFacts {
  const percent = order.header.prepaymentPercent;
  const printed = figuresOf(linesOf(order, kind, itemOf), kind, percent);
  const honest = figuresOf(linesOf(order, kind, itemOf, true), kind, percent);
  const dates = datesOf(
    anchor,
    kind,
    CREDIT_DAYS[customer.paymentTermsCode] ?? 0,
  );
  const n = Number(customer.no.slice(2));
  const isPo = kind === "CUSTOMER_PO";
  return {
    kind,
    stage: null,
    layout: isPo ? layoutForCustomer(customer.no) : "house",
    ref: order.header.no,
    orderNo: order.header.no,
    customerNo: customer.no,
    vendorNo: null,
    number: numberOf(anchor, kind),
    ...dates,
    poNumber: order.header.externalDocumentNo,
    issuer: isPo
      ? { kind: "customer", name: customer.name }
      : { kind: "spectra", name: SELLER.name },
    seller: SELLER,
    buyer: billTo(customer),
    shipTo: shipTo(order),
    contact: CONTACTS[n % CONTACTS.length] ?? CONTACTS[0],
    incoterms:
      order.header.shipmentMethodCode === "CIF"
        ? `CIF ${portOf(customer)}`
        : "FOB Singapore",
    paymentTerms: TERMS[customer.paymentTermsCode] ?? customer.paymentTermsCode,
    currency: "USD",
    lines: printed.lines,
    totals: printed.totals,
    due: printed.due,
    bank: kind === "PROFORMA_INVOICE" ? SELLER_BANK : null,
    planted: plantedOf(order.scenario, kind, printed, honest),
  };
}

/**
 * The facts of one order of the dataset given. Dates and dated numbers come
 * from the order as the set stands on its fixed reference date.
 */
export function buildFacts(
  dataset: SyntheticDataset,
  orderNo: string,
  kind: LegacyKind,
): DocumentFacts {
  if (!LEGACY_KINDS.includes(kind))
    throw new RangeError(`No ${kind} documents`);
  const order = find(
    dataset.orders,
    (o) => o.header.no === orderNo,
    `order ${orderNo}`,
  );
  const customer: Customer = find(
    dataset.customers,
    (c) => c.no === order.header.sellToCustomerNo,
    `customer ${order.header.sellToCustomerNo}`,
  );
  return factsFor(
    order,
    pinned(orderNo),
    customer,
    (no) => find(dataset.items, (it) => it.no === no, `item ${no}`),
    kind,
  );
}
