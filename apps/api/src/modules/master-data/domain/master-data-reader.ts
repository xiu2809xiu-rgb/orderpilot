// The records master data reads, in Business Central's field names. They belong to
// this port, not to any one source: the mock maps the synthetic set to them,
// and P-20's connector maps Business Central's OData responses the same way.

/** An item card, with its stock figures. */
export interface MasterDataItem {
  readonly no: string;
  readonly description: string;
  readonly partNumber: string;
  readonly brand: string;
  readonly category: "IT" | "SURVEILLANCE" | "ACCESSORIES";
  readonly baseUnitOfMeasure: string;
  readonly unitPrice: string;
  readonly unitCost: string;
  readonly inventory: string;
  readonly qtyOnSalesOrder: string;
  readonly qtyOnPurchOrder: string;
  readonly vendorNo: string;
  readonly vendorItemNo: string;
}

export interface MasterDataCustomer {
  readonly no: string;
  readonly name: string;
  readonly countryRegionCode: string;
  readonly currencyCode: string;
  readonly paymentTermsCode: string;
  readonly customerPriceGroup: string;
  readonly creditLimitLcy: string;
  readonly balanceLcy: string;
}

export interface MasterDataVendor {
  readonly no: string;
  readonly name: string;
  readonly currencyCode: string;
  readonly paymentTermsCode: string;
  readonly balanceLcy: string;
}

/** A vendor bank account. Every field but the code is masked by role. */
export interface MasterDataBankAccount {
  readonly code: string;
  readonly name: string;
  readonly bankAccountNo: string;
  readonly swiftCode: string;
  readonly iban: string;
}

export interface MasterDataPurchaseOrder {
  readonly no: string;
  readonly buyFromVendorNo: string;
  readonly orderDate: string;
  readonly expectedReceiptDate: string;
  readonly status: "open" | "received";
  readonly sprRecordNo: string | null;
  readonly lines: readonly {
    readonly no: string;
    /** What is still to arrive. Qty. on Purch. Order is the sum of these. */
    readonly outstandingQuantity: string;
    readonly unitCost: string;
  }[];
  readonly total: string;
}

/** A stock purchase request, as far as master data shows it. */
export interface MasterDataSpr {
  readonly recordNo: string;
  /** The purchase order it became, once approved. */
  readonly navisionNo: string | null;
  readonly orderNo: string;
  readonly status: "suggested" | "submitted" | "approved";
  readonly itemNo: string;
  readonly quantity: string;
  readonly needBy: string;
  readonly requestedBy: string;
}

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
    /**
     * The purchase order an approved SPR raised for the rest, or null while
     * the SPR waits. Until then the line is held out of Qty. on Sales Order.
     */
    readonly coveredBy: string | null;
  } | null;
  /** What is late and since when, as the tracker counts it. */
  readonly overdue: {
    readonly daysOverdue: number;
    readonly step: string;
    readonly dueDate: string;
  } | null;
}

/**
 * Where master data comes from. The service and the controller depend on this
 * alone, so P-20's connector replaces the one class behind it.
 */
export interface MasterDataReader {
  items(): Promise<readonly MasterDataItem[]>;
  customers(): Promise<readonly MasterDataCustomer[]>;
  vendors(): Promise<readonly MasterDataVendor[]>;
  vendorBankAccounts(
    vendorNo: string,
  ): Promise<readonly MasterDataBankAccount[]>;
  salesOrders(): Promise<readonly MasterDataSalesOrder[]>;
  purchaseOrders(): Promise<readonly MasterDataPurchaseOrder[]>;
  sprs(): Promise<readonly MasterDataSpr[]>;
}

/** The injection token for the reader. */
export const MASTER_DATA_READER = Symbol("MASTER_DATA_READER");
