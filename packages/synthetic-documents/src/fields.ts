import type { FieldSpec } from "./model.js";

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
