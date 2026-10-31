import type { DecimalString, SalesHeader, SalesLine } from "@orderpilot/shared";

/** Stamped on every dataset, and shown wherever the data is shown. */
export const SYNTHETIC_LABEL = "Synthetic demo data" as const;

// Field names follow Navision's, in camelCase (docs/research/domain-notes.md).
// Every amount is a USD decimal string, never a float.

export interface Customer {
  no: string;
  name: string;
  countryRegionCode: "IN" | "LK" | "BD" | "PK" | "AE";
  currencyCode: "USD";
  paymentTermsCode: string;
  customerPriceGroup: string;
  creditLimitLcy: DecimalString;
  balanceLcy: DecimalString;
}

export interface Vendor {
  no: string;
  name: string;
  currencyCode: "USD";
  paymentTermsCode: string;
  balanceLcy: DecimalString;
}

/** Obviously fake: an unassigned country code in the IBAN and a bank that says so. */
export interface VendorBankAccount {
  vendorNo: string;
  code: string;
  name: string;
  bankAccountNo: string;
  swiftCode: string;
  iban: string;
}

export interface Item {
  no: string;
  description: string;
  /** A fictional brand. */
  brand: string;
  baseUnitOfMeasure: "PCS";
  unitPrice: DecimalString;
  unitCost: DecimalString;
  inventory: DecimalString;
  qtyOnSalesOrder: DecimalString;
  qtyOnPurchOrder: DecimalString;
  vendorNo: string;
  vendorItemNo: string;
}

/**
 * A label for demo screens only. It is NOT an order status: area 2's state
 * machine alone owns that. The `sample-` prefix keeps the two apart, and
 * nothing may branch on these values outside demos and tests.
 */
export const SAMPLE_SCREEN_STATES = [
  "sample-po-received",
  "sample-extracted-awaiting-review",
  "sample-short-stock",
  "sample-awaiting-payment",
  "sample-pending-approval",
  "sample-ready-to-pick",
  "sample-packing-list-mismatch",
  "sample-awb-overdue",
  "sample-shipped",
  "sample-invoiced",
] as const;
export type SampleScreenState = (typeof SAMPLE_SCREEN_STATES)[number];

/** What is special about a sample order, so a screen or test can find it. */
export type SampleScenario =
  | { kind: "none" }
  | {
      kind: "short-stock";
      itemNo: string;
      ordered: DecimalString;
      inStock: DecimalString;
      shortBy: DecimalString;
      /** The stock purchase request the product would suggest. */
      suggestedSpr: {
        vendorNo: string;
        itemNo: string;
        quantity: DecimalString;
      };
    }
  | {
      kind: "awaiting-payment";
      prepaymentPercent: DecimalString;
      amountDue: DecimalString;
    }
  | {
      kind: "packing-list-mismatch";
      itemNo: string;
      ordered: DecimalString;
      packed: DecimalString;
    }
  | {
      kind: "awb-overdue";
      documentType: "AWB" | "BILL_OF_LADING";
      dueDate: string;
      daysOverdue: number;
    };

export interface SampleOrder {
  header: SalesHeader;
  lines: SalesLine[];
  sampleScreenState: SampleScreenState;
  scenario: SampleScenario;
}

export interface OpeningBalances {
  receivablesLcy: DecimalString;
  payablesLcy: DecimalString;
  stockValueLcy: DecimalString;
}

export interface SyntheticDataset {
  label: typeof SYNTHETIC_LABEL;
  seed: number;
  /** "Today" for every date and overdue rule in the data. */
  asOf: string;
  customers: Customer[];
  vendors: Vendor[];
  vendorBankAccounts: VendorBankAccount[];
  items: Item[];
  orders: SampleOrder[];
  openingBalances: OpeningBalances;
}
