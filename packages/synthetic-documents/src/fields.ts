import type { DocumentFacts, FactLine } from "./facts.js";
import { printDate, printMoney, printQuantity } from "./format.js";
import { spec, type FieldSpec } from "./model.js";

export interface LineFields {
  partNumber: FieldSpec;
  description: FieldSpec;
  quantity: FieldSpec;
  unitPrice: FieldSpec | null;
  amount: FieldSpec | null;
  cartons: FieldSpec | null;
  grossWeight: FieldSpec | null;
}

/** Every field a document of this kind carries, built once and placed by the layout. */
export interface Fields {
  number: FieldSpec;
  issueDate: FieldSpec;
  otherDate: FieldSpec | null;
  /** The customer's PO number, on documents that quote it. */
  poRef: FieldSpec | null;
  customerName: FieldSpec;
  billTo: FieldSpec | null;
  shipTo: FieldSpec;
  contact: FieldSpec | null;
  incoterms: FieldSpec | null;
  paymentTerms: FieldSpec | null;
  currency: FieldSpec | null;
  lines: LineFields[];
  total: FieldSpec | null;
  totalQuantity: FieldSpec | null;
  totalCartons: FieldSpec | null;
  totalGrossWeight: FieldSpec | null;
  amountDue: FieldSpec | null;
  balanceDue: FieldSpec | null;
  bank: {
    beneficiary: FieldSpec;
    bankName: FieldSpec;
    accountNo: FieldSpec;
    swiftCode: FieldSpec;
  } | null;
}

const NAMES = {
  CUSTOMER_PO: {
    number: ["poNumber", "PO number"],
    issue: ["poDate", "PO date"],
    other: ["requiredDate", "Required by"],
  },
  PROFORMA_INVOICE: {
    number: ["piNumber", "PI number"],
    issue: ["piDate", "PI date"],
    other: ["validUntil", "Valid until"],
  },
  PACKING_LIST: {
    number: ["packingListNumber", "Packing list number"],
    issue: ["packingListDate", "Packing list date"],
    other: ["", ""],
  },
  SALES_INVOICE: {
    number: ["invoiceNumber", "Invoice number"],
    issue: ["invoiceDate", "Invoice date"],
    other: ["dueDate", "Due date"],
  },
} as const;

function lineFields(
  line: FactLine,
  i: number,
  facts: DocumentFacts,
): LineFields {
  const priced = facts.kind !== "PACKING_LIST";
  const packed = facts.kind === "PACKING_LIST";
  const at = (key: string, label: string, value: string, text = value) =>
    spec(`lines.${key}`, label, "lines", value, text, i);
  return {
    partNumber: at("partNumber", "Part number", line.partNumber),
    description: at("description", "Description", line.description),
    quantity: at(
      "quantity",
      "Quantity",
      line.quantity,
      printQuantity(line.quantity),
    ),
    unitPrice: priced
      ? at(
          "unitPrice",
          "Unit price",
          line.unitPrice,
          printMoney(line.unitPrice),
        )
      : null,
    amount: priced
      ? at("amount", "Amount", line.amount, printMoney(line.amount))
      : null,
    cartons: packed ? at("cartons", "Cartons", line.cartons) : null,
    grossWeight: packed
      ? at("grossWeight", "Gross weight (kg)", line.grossKg)
      : null,
  };
}

export function fieldsOf(facts: DocumentFacts): Fields {
  const names = NAMES[facts.kind];
  const isPo = facts.kind === "CUSTOMER_PO";
  const packing = facts.kind === "PACKING_LIST";
  const header = (key: string, label: string, value: string, text = value) =>
    spec(key, label, "header", value, text);
  const totals = (key: string, label: string, value: string, text = value) =>
    spec(key, label, "totals", value, text);
  const bank = facts.bank;
  return {
    number: header(names.number[0], names.number[1], facts.number),
    issueDate: header(
      names.issue[0],
      names.issue[1],
      facts.issueDate,
      printDate(facts.issueDate),
    ),
    otherDate:
      facts.otherDate && names.other[0]
        ? header(
            names.other[0],
            names.other[1],
            facts.otherDate,
            printDate(facts.otherDate),
          )
        : null,
    poRef: isPo ? null : header("poNumber", "PO number", facts.poNumber),
    customerName: header(
      "customerName",
      packing ? "Consignee" : "Customer",
      facts.buyer.name,
    ),
    billTo: packing
      ? null
      : header(
          "billTo",
          "Bill to",
          facts.buyer.address.join(", "),
          facts.buyer.address.join("\n"),
        ),
    shipTo: header(
      "shipTo",
      "Ship to",
      [facts.shipTo.name, ...facts.shipTo.address].join(", "),
      [facts.shipTo.name, ...facts.shipTo.address].join("\n"),
    ),
    contact: isPo ? header("buyerContact", "Buyer", facts.contact) : null,
    incoterms: packing
      ? null
      : header("incoterms", "Incoterms", facts.incoterms),
    paymentTerms: packing
      ? null
      : header("paymentTerms", "Payment terms", facts.paymentTerms),
    currency: packing ? null : header("currency", "Currency", facts.currency),
    lines: facts.lines.map((line, i) => lineFields(line, i, facts)),
    total: packing
      ? null
      : totals(
          "total",
          "Total (USD)",
          facts.totals.amount,
          printMoney(facts.totals.amount),
        ),
    totalQuantity: packing
      ? totals(
          "totalQuantity",
          "Total quantity",
          facts.totals.quantity,
          printQuantity(facts.totals.quantity),
        )
      : null,
    totalCartons: packing
      ? totals("totalCartons", "Total cartons", facts.totals.cartons)
      : null,
    totalGrossWeight: packing
      ? totals(
          "totalGrossWeight",
          "Total gross weight (kg)",
          facts.totals.grossKg,
        )
      : null,
    amountDue: facts.due
      ? totals(
          "amountDue",
          `Due now (${facts.due.percent}%)`,
          facts.due.amount,
          printMoney(facts.due.amount),
        )
      : null,
    balanceDue: facts.due
      ? totals(
          "balanceDue",
          "Balance before shipment",
          facts.due.balance,
          printMoney(facts.due.balance),
        )
      : null,
    bank: bank
      ? {
          beneficiary: spec(
            "bankBeneficiary",
            "Beneficiary",
            "bank",
            bank.beneficiary,
          ),
          bankName: spec("bankName", "Bank", "bank", bank.bankName),
          accountNo: spec(
            "bankAccountNo",
            "Account number",
            "bank",
            bank.accountNo,
          ),
          swiftCode: spec("swiftCode", "SWIFT code", "bank", bank.swiftCode),
        }
      : null,
  };
}

/** Every field a layout must place, in reading order. */
export function allSpecs(fields: Fields): FieldSpec[] {
  const { bank } = fields;
  const all: (FieldSpec | null)[] = [
    fields.number,
    fields.issueDate,
    fields.otherDate,
    fields.poRef,
    fields.customerName,
    fields.billTo,
    fields.shipTo,
    fields.contact,
    fields.incoterms,
    fields.paymentTerms,
    fields.currency,
    ...fields.lines.flatMap((line) => [
      line.partNumber,
      line.description,
      line.quantity,
      line.unitPrice,
      line.amount,
      line.cartons,
      line.grossWeight,
    ]),
    fields.total,
    fields.totalQuantity,
    fields.totalCartons,
    fields.totalGrossWeight,
    fields.amountDue,
    fields.balanceDue,
    bank?.beneficiary ?? null,
    bank?.bankName ?? null,
    bank?.accountNo ?? null,
    bank?.swiftCode ?? null,
  ];
  return all.filter((field): field is FieldSpec => field !== null);
}
