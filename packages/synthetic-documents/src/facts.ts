import { addDecimal, multiplyDecimal } from "@orderpilot/shared";
import type { Customer, SyntheticDataset } from "@orderpilot/synthetic-data";
import {
  CONTACTS,
  CREDIT_DAYS,
  TERMS,
  layoutForCustomer,
} from "./facts-data.js";
import { linesOf } from "./facts-lines.js";
import { toCents, trimDecimal } from "./format.js";
import { DOCUMENT_KINDS, type DocumentKind, type LayoutId } from "./model.js";
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

export interface FactLine {
  partNumber: string;
  description: string;
  quantity: string;
  unitPrice: string;
  amount: string;
  cartons: string;
  grossKg: string;
}

export interface DocumentFacts {
  kind: DocumentKind;
  layout: LayoutId;
  orderNo: string;
  customerNo: string;
  /** The document's own number: the PO's, the PI's, the packing list's or the invoice's. */
  number: string;
  issueDate: string;
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
  currency: "USD";
  lines: FactLine[];
  totals: {
    amount: string;
    quantity: string;
    cartons: string;
    grossKg: string;
  };
  /** What a PI asks for now, when the terms ask for money up front. */
  due: { percent: string; amount: string; balance: string } | null;
  bank: BankDetails | null;
}

/**
 * What a PI asks for now, to the cent. Rounded here, half up, because a
 * printed amount has two decimals and the figure a customer pays must be the
 * one on the page.
 */
function dueNow(
  total: string,
  percent: string,
): NonNullable<DocumentFacts["due"]> {
  const amount = toCents(
    multiplyDecimal(total, (Number(percent) / 100).toFixed(4)),
  );
  return { percent, amount, balance: addDecimal(total, `-${amount}`) };
}

function sum(values: readonly string[]): string {
  return values.reduce((total, value) => addDecimal(total, value), "0");
}

/**
 * Everything a document prints, worked out once. The layouts only place it.
 * `dataset` may be any reference date: the documents of one order read the same.
 */
export function buildFacts(
  dataset: SyntheticDataset,
  orderNo: string,
  kind: DocumentKind,
): DocumentFacts {
  if (!DOCUMENT_KINDS.includes(kind))
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
  const anchor = pinned(orderNo);
  const lines = linesOf(order, kind, dataset.items);
  const amount = sum(lines.map((l) => l.amount));
  const percent = order.header.prepaymentPercent;
  const upfront = Number(percent) > 0;
  const dates = datesOf(
    anchor,
    kind,
    CREDIT_DAYS[customer.paymentTermsCode] ?? 0,
  );
  const n = Number(customer.no.slice(2));
  return {
    kind,
    layout: kind === "CUSTOMER_PO" ? layoutForCustomer(customer.no) : "house",
    orderNo,
    customerNo: customer.no,
    number: numberOf(anchor, kind),
    ...dates,
    poNumber: order.header.externalDocumentNo,
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
    lines,
    totals: {
      amount,
      quantity: trimDecimal(sum(lines.map((l) => l.quantity))),
      cartons: trimDecimal(sum(lines.map((l) => l.cartons))),
      grossKg: lines.reduce((s, l) => s + Number(l.grossKg), 0).toFixed(1),
    },
    due:
      kind === "PROFORMA_INVOICE" && upfront ? dueNow(amount, percent) : null,
    bank: kind === "PROFORMA_INVOICE" ? SELLER_BANK : null,
  };
}
