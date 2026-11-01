import type {
  Customer,
  Item,
  PurchaseOrder,
  SampleSpr,
  Vendor,
  VendorBankAccount,
} from "@orderpilot/synthetic-data";

/** A sales order as master data needs it: enough to reach it from an item or a customer. */
export interface MasterDataSalesOrder {
  readonly no: string;
  readonly customerNo: string;
  readonly externalDocumentNo: string;
  readonly orderDate: string;
  readonly shipmentDate: string | null;
  readonly status: string;
  readonly total: string;
  readonly lines: readonly {
    readonly no: string;
    readonly qtyToShip: string;
  }[];
  /** Set when a line wanted more than the item had. */
  readonly stockShortfall: {
    readonly itemNo: string;
    readonly ordered: string;
    readonly availableStock: string;
    readonly shortBy: string;
  } | null;
  readonly overdue: {
    readonly daysOverdue: number;
    readonly reason: string;
  } | null;
}

/**
 * Where master data comes from. The service and the controller depend on this
 * alone, so P-20's connector replaces the one class behind it.
 */
export interface MasterDataReader {
  items(): Promise<readonly Item[]>;
  customers(): Promise<readonly Customer[]>;
  vendors(): Promise<readonly Vendor[]>;
  vendorBankAccounts(vendorNo: string): Promise<readonly VendorBankAccount[]>;
  salesOrders(): Promise<readonly MasterDataSalesOrder[]>;
  purchaseOrders(): Promise<readonly PurchaseOrder[]>;
  sprs(): Promise<readonly SampleSpr[]>;
}

/** The injection token for the reader. */
export const MASTER_DATA_READER = Symbol("MASTER_DATA_READER");
