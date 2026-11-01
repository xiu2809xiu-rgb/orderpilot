import { addDecimal, multiplyDecimal } from "@orderpilot/shared";
import {
  AS_OF,
  addDays,
  syntheticDataset,
  type Customer,
  type Item,
  type SampleOrder,
  type SyntheticDataset,
} from "@orderpilot/synthetic-data";
import { toCents } from "./format.js";
import {
  DOCUMENT_KINDS,
  PO_LAYOUTS,
  type DocumentKind,
  type LayoutId,
} from "./model.js";
import {
  SELLER,
  SELLER_BANK,
  billTo,
  placeOf,
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

const CONTACTS = [
  "Anjelika Verrow",
  "Tomas Quillane",
  "Marisol Dunreith",
  "Kabir Ostrand",
  "Leilani Marchetti",
  "Dariusz Penhallow",
  "Imara Tolliver",
  "Rostam Fairweather",
] as const;

const TERMS: Readonly<Record<string, string>> = {
  "30 DAYS": "Net 30 days from invoice date",
  "60 DAYS": "Net 60 days from invoice date",
  PREPAID: "100% advance payment before shipment",
  "50% ADVANCE": "50% advance with order, balance before shipment",
  "30% DEPOSIT": "30% deposit with order, balance before shipment",
  "LC AT SIGHT": "Irrevocable letter of credit at sight",
};

const CREDIT_DAYS: Readonly<Record<string, number>> = {
  "30 DAYS": 30,
  "60 DAYS": 60,
};

// Pieces and kilograms in a carton, by what is inside it.
const CARTON: Readonly<
  Record<Item["category"], { pieces: number; kg: number }>
> = {
  IT: { pieces: 10, kg: 12 },
  SURVEILLANCE: { pieces: 5, kg: 9.5 },
  ACCESSORIES: { pieces: 50, kg: 8 },
};

/**
 * Which look a customer's PO has. The customer number picks it, so a customer
 * always sends the same one. The spread by five then four keeps neighbouring
 * customers apart and gives the first customers all four looks.
 */
export function layoutForCustomer(customerNo: string): LayoutId {
  const n = Number(customerNo.slice(2)) - 1;
  return PO_LAYOUTS[(n % 5) % PO_LAYOUTS.length] ?? "boxed";
}

function find<T>(
  list: readonly T[],
  test: (item: T) => boolean,
  what: string,
): T {
  const found = list.find(test);
  if (!found) throw new Error(`No ${what}`);
  return found;
}

/**
 * The dates and numbers a document prints. Dates in the synthetic set move
 * with today, but a committed file cannot, so these come from the set as it
 * stands on its fixed reference date. Everything else comes from the set the
 * caller passes, and does not move.
 */
function pinned(orderNo: string): SampleOrder {
  return find(
    syntheticDataset({ referenceDate: AS_OF }).orders,
    (o) => o.header.no === orderNo,
    `order ${orderNo}`,
  );
}

function numberOf(order: SampleOrder, kind: DocumentKind): string {
  const suffix = order.header.no.slice(3);
  const fallback: Record<DocumentKind, string> = {
    CUSTOMER_PO: order.header.externalDocumentNo,
    PROFORMA_INVOICE: `PI-${suffix}`,
    PACKING_LIST: `PL-${suffix}`,
    SALES_INVOICE: `SI-${suffix}`,
  };
  return order.documents.find((d) => d.type === kind)?.number ?? fallback[kind];
}

function datesOf(
  order: SampleOrder,
  kind: DocumentKind,
  creditDays: number,
): { issueDate: string; otherDate: string | null } {
  const ordered = order.header.orderDate;
  const done = order.milestones;
  switch (kind) {
    case "CUSTOMER_PO":
      return {
        issueDate: ordered,
        otherDate: order.header.shipmentDate ?? addDays(ordered, 21),
      };
    case "PROFORMA_INVOICE": {
      const issueDate = done.pi ?? addDays(ordered, 3);
      return { issueDate, otherDate: addDays(issueDate, 14) };
    }
    case "PACKING_LIST":
      return {
        issueDate: done.packed ?? addDays(ordered, 14),
        otherDate: null,
      };
    case "SALES_INVOICE": {
      const issueDate = done.invoiced ?? addDays(ordered, 18);
      return { issueDate, otherDate: addDays(issueDate, creditDays) };
    }
  }
}

function linesOf(
  order: SampleOrder,
  kind: DocumentKind,
  items: readonly Item[],
): FactLine[] {
  const { scenario } = order;
  return order.lines.map((line, i) => {
    const item = find(items, (it) => it.no === line.no, `item ${line.no}`);
    let { quantity, unitPrice } = line;
    // The customer's PO prints the price it believes in; the mismatch is for
    // the checks to find against the price list.
    if (
      kind === "CUSTOMER_PO" &&
      scenario.kind === "price-mismatch" &&
      i === 0
    ) {
      unitPrice = scenario.printed;
    }
    // The packing list counts what was packed, which is short on the first line.
    if (
      kind === "PACKING_LIST" &&
      scenario.kind === "packing-list-mismatch" &&
      i === 0
    ) {
      quantity = scenario.packed;
    }
    const carton = CARTON[item.category];
    const cartons = Math.ceil(Number(quantity) / carton.pieces);
    return {
      partNumber: item.partNumber,
      description: line.description,
      quantity,
      unitPrice,
      amount: multiplyDecimal(quantity, unitPrice),
      cartons: String(cartons),
      grossKg: (cartons * carton.kg).toFixed(1),
    };
  });
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
  const place = placeOf(customer);
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
    shipTo: shipTo(customer),
    contact: CONTACTS[n % CONTACTS.length] ?? CONTACTS[0],
    incoterms:
      order.header.shipmentMethodCode === "CIF"
        ? `CIF ${place.port}`
        : "FOB Singapore",
    paymentTerms: TERMS[customer.paymentTermsCode] ?? customer.paymentTermsCode,
    currency: "USD",
    lines,
    totals: {
      amount,
      quantity: sum(lines.map((l) => l.quantity)),
      cartons: sum(lines.map((l) => l.cartons)),
      grossKg: lines.reduce((s, l) => s + Number(l.grossKg), 0).toFixed(1),
    },
    due:
      kind === "PROFORMA_INVOICE" && upfront ? dueNow(amount, percent) : null,
    bank: kind === "PROFORMA_INVOICE" ? SELLER_BANK : null,
  };
}
