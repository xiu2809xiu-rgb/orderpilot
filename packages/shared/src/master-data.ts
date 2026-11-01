// The contract of the master data pages: items, customers and vendors as
// Navision holds them. Read-only: Navision stays the system of record. Field
// names follow Navision's, and every record is matched on its number, never on
// its name.

import { z } from "zod";
import { mockEnvelope, mockPageEnvelope } from "./checks.js";
import { maskedFieldSchema } from "./governance/masking.js";
import { decimalStringSchema } from "./money.js";

/** A number in the path or a filter: `I-0001`, `C-0001`, `V-0001`. */
export const navisionNoSchema = z
  .string()
  .trim()
  .regex(/^[A-Za-z0-9-]{1,20}$/);

export const ITEM_CATEGORY_CODES = [
  "IT",
  "SURVEILLANCE",
  "ACCESSORIES",
] as const;

/**
 * Where an item stands. `short`: an open order needs more than the available
 * stock. `low`: available stock is under a small threshold. `ok`: neither.
 */
export const ITEM_AVAILABILITIES = ["short", "low", "ok"] as const;
export const itemAvailabilitySchema = z.enum(ITEM_AVAILABILITIES);
export type ItemAvailability = z.infer<typeof itemAvailabilitySchema>;

const direction = z.enum(["asc", "desc"]).optional();
const page = z.coerce.number().int().min(1).default(1);
/** The most rows one page of a master data list holds. */
export const MASTER_DATA_MAX_PAGE_SIZE = 200;

const pageSize = z.coerce
  .number()
  .int()
  .min(1)
  .max(MASTER_DATA_MAX_PAGE_SIZE)
  .default(25);
const search = z.string().trim().max(100).optional();
const filterText = z.string().trim().min(1).max(60).optional();

// ---- Items ------------------------------------------------------------------

export const ITEM_SORT_COLUMNS = [
  "no",
  "description",
  "brand",
  "inventory",
  "qtyOnSalesOrder",
  "qtyOnPurchOrder",
  "availableStock",
  "unitPrice",
] as const;

export const itemQuerySchema = z.object({
  page,
  pageSize,
  search,
  brand: filterText,
  category: z.enum(ITEM_CATEGORY_CODES).optional(),
  vendor: navisionNoSchema.optional(),
  availability: itemAvailabilitySchema.optional(),
  sort: z.enum(ITEM_SORT_COLUMNS).optional(),
  direction,
});
export type ItemQuery = z.infer<typeof itemQuerySchema>;

export const itemRowSchema = z.object({
  no: z.string().min(1),
  description: z.string().min(1),
  partNumber: z.string().min(1),
  brand: z.string().min(1),
  category: z.enum(ITEM_CATEGORY_CODES),
  baseUnitOfMeasure: z.string().min(1),
  inventory: decimalStringSchema,
  qtyOnSalesOrder: decimalStringSchema,
  qtyOnPurchOrder: decimalStringSchema,
  /** Inventory minus Qty. on Sales Order plus Qty. on Purch. Order. */
  availableStock: decimalStringSchema,
  availability: itemAvailabilitySchema,
  /** The selling price. Masked for roles that do not quote it. */
  unitPrice: maskedFieldSchema,
  vendorNo: z.string().min(1),
  vendorName: z.string().min(1),
});
export type ItemRow = z.infer<typeof itemRowSchema>;

export const PURCHASE_ORDER_STATES = ["open", "received"] as const;
const purchaseOrderState = z.enum(PURCHASE_ORDER_STATES);

/** Why a line asks for more than the item could cover. */
export const lineShortfallSchema = z.object({
  /**
   * `waiting`: the SPR is not approved yet, so the line is held out of Qty.
   * on Sales Order. `covered`: an approved SPR's purchase order brings the
   * rest, and the line counts as demand like any other.
   */
  state: z.enum(["waiting", "covered"]),
  ordered: decimalStringSchema,
  availableStock: decimalStringSchema,
  shortBy: decimalStringSchema,
  sprRecordNo: z.string().nullable(),
  purchaseOrderNo: z.string().nullable(),
  /** Whether that purchase order is still on its way or has arrived. */
  purchaseOrderStatus: purchaseOrderState.nullable(),
});
export type LineShortfall = z.infer<typeof lineShortfallSchema>;

export const itemOrderLineSchema = z.object({
  orderNo: z.string().min(1),
  customerNo: z.string().min(1),
  customerName: z.string().min(1),
  orderDate: z.string().min(1),
  shipmentDate: z.string().nullable(),
  status: z.string().min(1),
  /** What is left to ship on this order's line for the item. */
  quantity: decimalStringSchema,
  /** A short line whose SPR waits: not counted in Qty. on Sales Order, as the demand under review. */
  heldOut: z.boolean(),
  shortfall: lineShortfallSchema.nullable(),
});

export const itemPurchaseLineSchema = z.object({
  purchaseOrderNo: z.string().min(1),
  orderDate: z.string().min(1),
  expectedReceiptDate: z.string().min(1),
  /** What is still to arrive. These add up to Qty. on Purch. Order. */
  outstandingQuantity: decimalStringSchema,
  unitCost: maskedFieldSchema,
  sprRecordNo: z.string().nullable(),
});

export const itemSprSchema = z.object({
  recordNo: z.string().min(1),
  navisionNo: z.string().nullable(),
  /** The state of that purchase order: a received one is no longer open. */
  purchaseOrderStatus: purchaseOrderState.nullable(),
  orderNo: z.string().min(1),
  status: z.enum(["suggested", "submitted", "approved"]),
  quantity: decimalStringSchema,
  needBy: z.string().min(1),
  requestedBy: z.string().min(1),
});

export const itemDetailSchema = itemRowSchema.extend({
  vendorItemNo: z.string().min(1),
  /** Masked for roles that do not work with cost. */
  unitCost: maskedFieldSchema,
  orderLines: z.array(itemOrderLineSchema),
  /**
   * How Qty. on Sales Order is made up: `listed` is the open lines that count
   * towards it, and equals it. Held-out lines are apart, in `heldOut`.
   */
  salesOrderBreakdown: z.object({
    listed: decimalStringSchema,
    heldOut: decimalStringSchema,
  }),
  purchaseLines: z.array(itemPurchaseLineSchema),
  sprs: z.array(itemSprSchema),
});
export type ItemDetail = z.infer<typeof itemDetailSchema>;

// ---- Customers --------------------------------------------------------------

export const CUSTOMER_SORT_COLUMNS = [
  "no",
  "name",
  "openOrders",
  "overdueOrders",
] as const;

export const customerQuerySchema = z.object({
  page,
  pageSize,
  search,
  country: filterText,
  paymentTerms: filterText,
  priceGroup: filterText,
  sort: z.enum(CUSTOMER_SORT_COLUMNS).optional(),
  direction,
});
export type CustomerQuery = z.infer<typeof customerQuerySchema>;

export const customerRowSchema = z.object({
  no: z.string().min(1),
  name: z.string().min(1),
  countryRegionCode: z.string().min(1),
  currencyCode: z.string().min(1),
  paymentTermsCode: z.string().min(1),
  customerPriceGroup: z.string().min(1),
  openOrders: z.int().min(0),
  overdueOrders: z.int().min(0),
});
export type CustomerRow = z.infer<typeof customerRowSchema>;

export const customerOrderSchema = z.object({
  orderNo: z.string().min(1),
  externalDocumentNo: z.string().min(1),
  orderDate: z.string().min(1),
  shipmentDate: z.string().nullable(),
  status: z.string().min(1),
  /** Masked with the selling price: a total gives the prices away. */
  amount: maskedFieldSchema,
});

export const customerOverdueSchema = z.object({
  orderNo: z.string().min(1),
  externalDocumentNo: z.string().min(1),
  daysOverdue: z.int().min(1),
  /** The step or document that is late, as the tracker names it. */
  step: z.string().min(1),
  dueDate: z.string().min(1),
});

export const customerDetailSchema = customerRowSchema
  .omit({ openOrders: true, overdueOrders: true })
  .extend({
    /** Masked, with the balance, for roles that never price anything. */
    creditLimitLcy: maskedFieldSchema,
    balanceLcy: maskedFieldSchema,
    openOrders: z.array(customerOrderSchema),
    overdueOrders: z.array(customerOverdueSchema),
  });
export type CustomerDetail = z.infer<typeof customerDetailSchema>;

// ---- Vendors ----------------------------------------------------------------

export const VENDOR_SORT_COLUMNS = [
  "no",
  "name",
  "openPurchaseOrders",
  "itemsSupplied",
  "balanceLcy",
] as const;

export const vendorQuerySchema = z.object({
  page,
  pageSize,
  search,
  sort: z.enum(VENDOR_SORT_COLUMNS).optional(),
  direction,
});
export type VendorQuery = z.infer<typeof vendorQuerySchema>;

export const vendorRowSchema = z.object({
  no: z.string().min(1),
  name: z.string().min(1),
  currencyCode: z.string().min(1),
  paymentTermsCode: z.string().min(1),
  openPurchaseOrders: z.int().min(0),
  itemsSupplied: z.int().min(0),
  /** Masked for roles that never price anything. */
  balanceLcy: maskedFieldSchema,
});
export type VendorRow = z.infer<typeof vendorRowSchema>;

/** Every part of an account that could move money is masked on its own. */
export const vendorBankAccountSchema = z.object({
  code: z.string().min(1),
  bankName: maskedFieldSchema,
  bankAccountNo: maskedFieldSchema,
  swiftCode: maskedFieldSchema,
  iban: maskedFieldSchema,
});

export const vendorPurchaseOrderSchema = z.object({
  no: z.string().min(1),
  orderDate: z.string().min(1),
  expectedReceiptDate: z.string().min(1),
  lines: z.int().min(1),
  outstandingQuantity: decimalStringSchema,
  /** Masked with the item cost: a total gives the costs away. */
  total: maskedFieldSchema,
  sprRecordNo: z.string().nullable(),
});

export const vendorItemSchema = z.object({
  no: z.string().min(1),
  description: z.string().min(1),
  vendorItemNo: z.string().min(1),
  availableStock: decimalStringSchema,
  availability: itemAvailabilitySchema,
});

export const vendorDetailSchema = vendorRowSchema
  .omit({ openPurchaseOrders: true, itemsSupplied: true })
  .extend({
    bankAccounts: z.array(vendorBankAccountSchema),
    openPurchaseOrders: z.array(vendorPurchaseOrderSchema),
    items: z.array(vendorItemSchema),
  });
export type VendorDetail = z.infer<typeof vendorDetailSchema>;

// ---- What the filters can offer ---------------------------------------------

export const masterDataFiltersSchema = z.object({
  brands: z.array(z.string()),
  categories: z.array(z.enum(ITEM_CATEGORY_CODES)),
  vendors: z.array(z.object({ no: z.string(), name: z.string() })),
  countries: z.array(z.string()),
  paymentTerms: z.array(z.string()),
  priceGroups: z.array(z.string()),
});
export type MasterDataFilters = z.infer<typeof masterDataFiltersSchema>;

export const itemListSchema = mockPageEnvelope(itemRowSchema);
export const itemResponseSchema = mockEnvelope(itemDetailSchema);
export const customerListSchema = mockPageEnvelope(customerRowSchema);
export const customerResponseSchema = mockEnvelope(customerDetailSchema);
export const vendorListSchema = mockPageEnvelope(vendorRowSchema);
export const vendorResponseSchema = mockEnvelope(vendorDetailSchema);
export const masterDataFiltersResponseSchema = mockEnvelope(
  masterDataFiltersSchema,
);
