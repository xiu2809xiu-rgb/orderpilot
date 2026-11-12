import type {
  DocumentKind,
  Issuer,
  LayoutId,
  MistakeKind,
  Stage,
} from "./model.js";

export interface FactLine {
  partNumber: string;
  description: string;
  quantity: string;
  unitPrice: string;
  amount: string;
  cartons: string;
  grossKg: string;
  /** Vendor documents only. */
  vendorItemNo?: string;
  netKg?: string;
}

export interface Totals {
  amount: string;
  quantity: string;
  cartons: string;
  grossKg: string;
}

/** What a PI asks for now, when the terms ask for money up front. */
export interface Due {
  percent: string;
  amount: string;
  balance: string;
}

/** The lines of a document and the sums that follow from them. */
export interface Figures {
  lines: FactLine[];
  totals: Totals;
  due: Due | null;
}

/**
 * What the renderer printed that is wrong on purpose, found nowhere else. The
 * first value is the field a person would fix. The others follow from it
 * (an amount, a total) and only differ because it does.
 */
export interface PlantedRecord {
  kind: MistakeKind;
  lineIndex: number | null;
  primaryFieldId: string;
  values: { fieldId: string; printed: string; expected: string }[];
}

/** What every kind of document knows about itself, whatever it prints. */
export interface BaseFacts {
  kind: DocumentKind;
  stage: Stage | null;
  layout: LayoutId;
  /** The record the document hangs on: "SO-0102", "PO-0021", "TT-0058-PRE". The confidence hash reads it. */
  ref: string;
  orderNo: string | null;
  customerNo: string | null;
  vendorNo: string | null;
  number: string;
  issueDate: string;
  /** The customer's PO number, when the document quotes it. */
  poNumber: string | null;
  issuer: { kind: Issuer; name: string };
  currency: "USD";
  lines: FactLine[];
  /** At most one: a document is a case of one mistake. */
  planted: PlantedRecord | null;
}
