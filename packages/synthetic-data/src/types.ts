import type {
  DecimalString,
  DocumentType,
  PaymentType,
  Role,
  SalesHeader,
  SalesLine,
  TaskKind,
  TaskPriority,
  WorkflowReminder,
  WorkflowTask,
} from "@orderpilot/shared";
import type { Milestone } from "./journey.js";

/** Stamped on every dataset, and shown wherever the data is shown. */
export const SYNTHETIC_LABEL = "Synthetic demo data" as const;

// Field names follow Business Central's, in camelCase (docs/research/domain-notes.md).
// Every amount is a USD decimal string, never a float.

/** The eleven countries Spectra's customers are in. */
export const COUNTRY_CODES = [
  "AE",
  "PK",
  "LK",
  "MV",
  "IN",
  "NP",
  "BD",
  "VN",
  "SG",
  "ID",
  "MY",
] as const;
export type CountryCode = (typeof COUNTRY_CODES)[number];

export interface Customer {
  no: string;
  name: string;
  countryRegionCode: CountryCode;
  currencyCode: "USD";
  paymentTermsCode: string;
  /** Made up, in a real city (Business Central's address fields). */
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  postalCode: string;
  /** Obviously fake: the country code, ZZ and a run of zeros. */
  taxRegistrationNumber: string;
  creditLimitLcy: DecimalString;
  balanceLcy: DecimalString;
}

export interface Vendor {
  no: string;
  name: string;
  currencyCode: "USD";
  paymentTermsCode: string;
  balanceLcy: DecimalString;
  /** The median lead time of the items it supplies, in days. */
  leadTimeDays: number;
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

export const ITEM_CATEGORIES = [
  "COMPONENTS",
  "PERIPHERALS",
  "PCS",
  "ENTERPRISE",
  "SECURITY",
  "NETWORKING",
] as const;
export type ItemCategory = (typeof ITEM_CATEGORIES)[number];

export interface Item {
  no: string;
  description: string;
  /** A real brand name Spectra carries, as plain text (ADR 0051). */
  brand: string;
  category: ItemCategory;
  /** A made-up part number in the brand's style, such as `210-ZZ0001`. */
  partNumber: string;
  baseUnitOfMeasure: "PCS";
  unitPrice: DecimalString;
  unitCost: DecimalString;
  inventory: DecimalString;
  qtyOnSalesOrder: DecimalString;
  qtyOnPurchOrder: DecimalString;
  vendorNo: string;
  vendorItemNo: string;
  /** Days from the vendor's order to the goods arriving. */
  leadTimeDays: number;
  /**
   * Units sold a month over the last three whole months. OrderPilot's own
   * figure, not a Business Central field; the history adds up to it.
   */
  runRate3m: DecimalString;
  /** Inventory over `runRate3m`, in months; null when nothing sold. */
  monthsOfCover: DecimalString | null;
}

/** A person on the team, by the role they hold. A product manager lists the brands they own. */
export interface Person {
  name: string;
  role: Role;
  brands: string[];
  /** The Support person who routes each SPR; not one of those who own orders. */
  sprCoordinator?: true;
}

export interface Brand {
  name: string;
  category: ItemCategory;
  /** The product manager who owns it. */
  owner: string;
}

/**
 * A label for demo screens only. It is NOT an order status: area 2's state
 * machine alone owns that. The `sample-` prefix keeps the two apart, and
 * nothing may branch on these values outside demos and tests. They run in the
 * order an order moves through the sales flow.
 */
export const SAMPLE_SCREEN_STATES = [
  "sample-po-received",
  "sample-extracted-awaiting-review",
  "sample-short-stock",
  "sample-pending-approval",
  "sample-pi-to-send",
  "sample-awaiting-payment",
  "sample-ready-to-pick",
  "sample-packing-list-mismatch",
  "sample-awb-overdue",
  "sample-shipped",
  "sample-invoiced",
  "sample-closed",
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
      kind: "pi-price-mismatch";
      itemNo: string;
      /** The unit price on the customer's PO, which is the agreed one. */
      poPrice: DecimalString;
      /** The higher price the draft PI prints on its first line. */
      piPrice: DecimalString;
    }
  | {
      kind: "awb-overdue";
      documentType: "AWB" | "BILL_OF_LADING";
      dueDate: string;
      daysOverdue: number;
    }
  | { kind: "import-permit-missing"; dueDate: string };

export type SamplePriority = TaskPriority;

/** Who looks after an order, by name. The product manager is the owner of the first line's brand. */
export interface OrderOwners {
  support: string;
  productManager: string;
  approver: string;
  finance: string;
  warehouse: string;
  logistics: string;
}

export const DOCUMENT_STATUSES = [
  "to-confirm",
  "confirmed",
  "expected",
] as const;
export type DocumentStatus = (typeof DOCUMENT_STATUSES)[number];

/**
 * A document on an order: `DocumentRef`'s fields plus the document's own
 * number and where it stands. `expected` means it is due and not here yet.
 * OrderPilot's own numbers (a PI) use the shared record format.
 */
export interface OrderDocument {
  id: string;
  orderNo: string;
  type: DocumentType;
  /** The number printed on it, or OrderPilot's own for a PI. Null while it is only expected. */
  number: string | null;
  fileName: string;
  status: DocumentStatus;
  source: "email" | "upload" | "navision" | "orderpilot";
  /** Null while it is only expected. */
  receivedAt: string | null;
  /** When an expected document is due. */
  dueDate: string | null;
  /** Who confirmed it, once confirmed. */
  confirmedBy: string | null;
  /** On a shipping document: the consignee it names, when that is not the buyer. */
  consignee?: string;
  /** On a shipping document: who the carrier notifies on arrival. */
  notifyParty?: string;
}

/** Where an order stands in the day-by-day story the data tells. */
export interface OrderStep {
  /** The day the order reached its sample state. */
  enteredOn: string;
  /** When the work waiting on it is due (a fixture value, not a service level), or null. */
  dueOn: string | null;
}

/** Where the goods go: the customer's own name and address. */
export interface ShipTo {
  name: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  postalCode: string;
  countryRegionCode: CountryCode;
}

export interface SampleOrder {
  header: SalesHeader;
  shipTo: ShipTo;
  lines: SalesLine[];
  sampleScreenState: SampleScreenState;
  scenario: SampleScenario;
  /** Sum of the lines. */
  total: DecimalString;
  /** Whole days since the order date, at the reference date. */
  ageDays: number;
  priority: SamplePriority;
  owners: OrderOwners;
  documents: OrderDocument[];
  step: OrderStep;
  /** The day each fixture step was done, as far as the order has come. */
  milestones: Partial<Record<Milestone, string>>;
  /** Set when a line wants more than the item has: the SPR follows from it. */
  stockShortfall: {
    itemNo: string;
    ordered: DecimalString;
    availableStock: DecimalString;
    shortBy: DecimalString;
  } | null;
}

export const PAYMENT_STATUSES = ["expected", "confirmed"] as const;

export interface SamplePayment {
  id: string;
  orderNo: string;
  customerNo: string;
  paymentType: PaymentType;
  amount: DecimalString;
  currencyCode: "USD";
  status: (typeof PAYMENT_STATUSES)[number];
  /** When an expected payment is due. */
  dueOn: string;
  /** Bank reference, once paid. */
  reference: string | null;
  paidOn: string | null;
  confirmedAt: string | null;
  confirmedBy: string | null;
}

export const PURCHASE_ORDER_STATUSES = ["open", "received"] as const;

/** A line of a purchase order. `no` is the item's number, as on a sales line. */
export interface PurchaseLine {
  no: string;
  description: string;
  quantity: DecimalString;
  /** What is still to arrive. Qty. on Purch. Order is the sum of these. */
  outstandingQuantity: DecimalString;
  unitCost: DecimalString;
  lineAmount: DecimalString;
}

/** A vendor purchase order in Business Central, from an approved SPR or already on order. */
export interface PurchaseOrder {
  no: string;
  buyFromVendorNo: string;
  orderDate: string;
  expectedReceiptDate: string;
  currencyCode: "USD";
  status: (typeof PURCHASE_ORDER_STATUSES)[number];
  /** The SPR it came from, or null for an order no SPR explains. */
  sprRecordNo: string | null;
  lines: PurchaseLine[];
  /** Sum of the lines. */
  total: DecimalString;
}

export const SPR_STATUSES = ["suggested", "submitted", "approved"] as const;

/**
 * A stock purchase request. `basis` follows prompt 002's formula: available
 * stock is Inventory minus Qty. on Sales Order plus Qty. on Purch. Order, and
 * the shortfall is what the order wants beyond it.
 */
export interface SampleSpr {
  recordNo: string;
  /** Business Central's purchase order number, once the SPR is approved and posted. */
  navisionNo: string | null;
  orderNo: string;
  status: (typeof SPR_STATUSES)[number];
  itemNo: string;
  vendorNo: string;
  requestedBy: string;
  requestedAt: string;
  quantity: DecimalString;
  unitCost: DecimalString;
  amount: DecimalString;
  needBy: string;
  notes: string;
  basis: {
    ordered: DecimalString;
    inventory: DecimalString;
    qtyOnSalesOrder: DecimalString;
    qtyOnPurchOrder: DecimalString;
    availableStock: DecimalString;
    shortfall: DecimalString;
  };
  decision: {
    outcome: "approved";
    by: string;
    comment: string;
    at: string;
  } | null;
}

/** A task as the inboxes show it: the contract's fields, with the extras filled in. */
export type SampleTask = WorkflowTask &
  Required<
    Pick<
      WorkflowTask,
      | "customerNo"
      | "customerName"
      | "amount"
      | "currencyCode"
      | "priority"
      | "assigneeName"
    >
  > & { kind: TaskKind };

export type SampleReminder = WorkflowReminder;

export interface SampleException {
  /** OrderPilot's number, such as `EXC-20261030-0001`. */
  recordNo: string;
  orderNo: string;
  customerNo: string;
  ruleId: string;
  ruleLabel: string;
  summary: string;
  expected: string;
  found: string;
  difference: string;
  toleranceLabel: string;
  toleranceValue: string;
  fixBy: Role;
  state: "OPEN" | "RESOLVED";
  openedAt: string;
  resolvedAt: string | null;
}

export interface WeeklyValue {
  /** The Monday that starts the week. */
  weekStart: string;
  value: number;
}

export interface KpiSeries {
  id:
    | "processingTime"
    | "manualTouches"
    | "dataEntryErrors"
    | "approvalTurnaround"
    | "overdueOrders";
  /** Fixture values: no protocol has run yet. */
  manual: number;
  target: number;
  /** Twelve weeks, oldest first, the last of them the week of the reference date. */
  weekly: WeeklyValue[];
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
  people: Person[];
  brands: Brand[];
  customers: Customer[];
  vendors: Vendor[];
  vendorBankAccounts: VendorBankAccount[];
  items: Item[];
  orders: SampleOrder[];
  payments: SamplePayment[];
  sprs: SampleSpr[];
  purchaseOrders: PurchaseOrder[];
  tasks: SampleTask[];
  reminders: SampleReminder[];
  exceptions: SampleException[];
  kpis: KpiSeries[];
  openingBalances: OpeningBalances;
}
