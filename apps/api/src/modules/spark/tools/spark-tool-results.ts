import type {
  ItemRow,
  MaskedField,
  SalesOrderDetail,
  SalesOrderRow,
  SparkSource,
} from "@orderpilot/shared";
import { z } from "zod";

// What each of Spark's tools hands the model, and the sources it hands the
// run. Every result is built by NAMING the fields it keeps, one by one: a
// service's row is never spread or passed through, so a field added to a
// service later (a vendor, a bank detail, a customer's own reference, a cost)
// reaches the model only when someone adds it here and a reviewer sees it.
// The same projection feeds the run's sources, so what a person is shown as
// "looked at" is what the model was given. The schemas are exported because
// the offline mock reads a tool's result back through them.

/** The most items, orders and order lines one result holds, and so the most chips one tool adds. */
export const MAX_STOCK_ITEMS = 5;
export const MAX_ORDERS = 10;
export const MAX_ORDER_LINES = 20;
/** A free-text field is cut here: a description is a record's own text, and a long one is not an answer. */
const TEXT_CUT = 120;
/**
 * The most characters one result may have. The tool loop cuts a result at
 * 20,000 and appends a note, which would break its JSON and let the sources
 * show rows the model never saw. These caps keep every result far below that,
 * and a test holds them to this figure with the worst input.
 */
export const MAX_RESULT_CHARACTERS = 12_000;

const cut = (text: string): string =>
  text.length > TEXT_CUT ? `${text.slice(0, TEXT_CUT - 1)}…` : text;

/** Money as the model gets it: a value, or the fact that the person's role may not see one. */
export const priceSchema = z.union([
  z.object({ hidden: z.literal(true), reason: z.string() }),
  z.object({ value: z.string(), currency: z.string() }),
]);
export type Price = z.infer<typeof priceSchema>;

/**
 * The services have already masked the field for the role. A masked field has
 * no value to forward, and a field that claims not to be masked but has none
 * is treated as masked, so nothing is ever guessed.
 */
function priceOf(field: MaskedField, currency: string): Price {
  if (field.masked || field.value === null) {
    return { hidden: true, reason: field.reason ?? "role" };
  }
  return { value: field.value, currency };
}

const shortageSchema = z.object({
  itemNo: z.string(),
  ordered: z.string(),
  availableStock: z.string(),
  shortBy: z.string(),
});

// ---- check_stock ----------------------------------------------------------

export const stockItemSchema = z.object({
  itemNo: z.string(),
  description: z.string(),
  partNumber: z.string(),
  brand: z.string(),
  unit: z.string(),
  onHand: z.string(),
  onSalesOrders: z.string(),
  onPurchaseOrders: z.string(),
  available: z.string(),
  availability: z.string(),
  unitPrice: priceSchema,
});

export const stockResultSchema = z.union([
  z.object({
    found: z.literal(true),
    /** How many items matched, which can be more than the items shown. */
    matched: z.int(),
    items: z.array(stockItemSchema),
  }),
  z.object({ found: z.literal(false), message: z.string() }),
]);
export type StockResult = z.infer<typeof stockResultSchema>;

/** What a tool returns, and the sources it adds to the run. */
export interface ToolOutput<T> {
  readonly result: T;
  readonly sources: readonly SparkSource[];
}

export function stockOutputOf(page: {
  readonly items: readonly ItemRow[];
  readonly total: number;
}): ToolOutput<StockResult> {
  const rows = page.items.slice(0, MAX_STOCK_ITEMS);
  if (rows.length === 0) {
    return {
      result: { found: false, message: "No item matches that search." },
      sources: [],
    };
  }
  return {
    result: {
      found: true,
      matched: page.total,
      items: rows.map((row) => ({
        itemNo: row.no,
        description: cut(row.description),
        partNumber: row.partNumber,
        brand: row.brand,
        unit: row.baseUnitOfMeasure,
        onHand: row.inventory,
        onSalesOrders: row.qtyOnSalesOrder,
        onPurchaseOrders: row.qtyOnPurchOrder,
        available: row.availableStock,
        availability: row.availability,
        unitPrice: priceOf(row.unitPrice, "USD"),
      })),
    },
    sources: rows.map((row) => ({
      kind: "item" as const,
      id: row.no,
      label: `Item ${row.no}, ${cut(row.description)}`.slice(0, 200),
    })),
  };
}

// ---- find_orders and get_order -------------------------------------------

const orderRowSchema = z.object({
  orderNo: z.string(),
  customerNo: z.string(),
  customerName: z.string().nullable(),
  orderDate: z.string(),
  shipmentDate: z.string().nullable(),
  status: z.string().nullable(),
  captureState: z.string().nullable(),
  amount: priceSchema,
  shortage: shortageSchema.nullable(),
  shortageCount: z.int(),
});
export type OrderRowResult = z.infer<typeof orderRowSchema>;

export const ordersResultSchema = z.union([
  z.object({
    found: z.literal(true),
    matched: z.int(),
    orders: z.array(orderRowSchema),
  }),
  z.object({ found: z.literal(false), message: z.string() }),
]);
export type OrdersResult = z.infer<typeof ordersResultSchema>;

const orderLineSchema = z.object({
  lineNo: z.int(),
  itemNo: z.string(),
  description: z.string(),
  quantity: z.string(),
  qtyToShip: z.string(),
  unitPrice: priceSchema,
  lineAmount: priceSchema,
  shortBy: z.string().nullable(),
});

export const orderResultSchema = z.union([
  z.object({
    found: z.literal(true),
    order: orderRowSchema.extend({
      lineCount: z.int(),
      lines: z.array(orderLineSchema),
    }),
  }),
  z.object({ found: z.literal(false), message: z.string() }),
]);
export type OrderResult = z.infer<typeof orderResultSchema>;

/**
 * An order as a row of Spark's answer. The customer's own document number, the
 * Navision number, the prepayment and the version are left out on purpose: the
 * question is where an order stands, and none of them answers it.
 */
function orderRowOf(row: SalesOrderRow): OrderRowResult {
  return {
    orderNo: row.orderNo,
    customerNo: row.customerNo,
    customerName: row.customerName === null ? null : cut(row.customerName),
    orderDate: row.orderDate,
    shipmentDate: row.shipmentDate,
    status: row.workflowStatus,
    captureState: row.captureState,
    amount: priceOf(row.amount, row.currencyCode),
    shortage:
      row.shortage === null
        ? null
        : {
            itemNo: row.shortage.itemNo,
            ordered: row.shortage.ordered,
            availableStock: row.shortage.availableStock,
            shortBy: row.shortage.shortBy,
          },
    shortageCount: row.shortageCount,
  };
}

const orderSourceOf = (orderNo: string): SparkSource => ({
  kind: "order",
  id: orderNo,
  label: `Order ${orderNo}`,
});

export function ordersOutputOf(page: {
  readonly items: readonly SalesOrderRow[];
  readonly total: number;
}): ToolOutput<OrdersResult> {
  const rows = page.items.slice(0, MAX_ORDERS);
  if (rows.length === 0) {
    return {
      result: { found: false, message: "No order matches that search." },
      sources: [],
    };
  }
  return {
    result: { found: true, matched: page.total, orders: rows.map(orderRowOf) },
    sources: rows.map((row) => orderSourceOf(row.orderNo)),
  };
}

export const NO_SUCH_ORDER = "There is no order with that number.";

export function orderOutputOf(
  detail: SalesOrderDetail,
): ToolOutput<OrderResult> {
  return {
    result: {
      found: true,
      order: {
        ...orderRowOf(detail),
        lineCount: detail.lines.length,
        lines: detail.lines.slice(0, MAX_ORDER_LINES).map((line) => ({
          lineNo: line.lineNo,
          itemNo: line.itemNo,
          description: cut(line.description),
          quantity: line.quantity,
          qtyToShip: line.qtyToShip,
          unitPrice: priceOf(line.unitPrice, detail.currencyCode),
          lineAmount: priceOf(line.lineAmount, detail.currencyCode),
          shortBy: line.shortBy,
        })),
      },
    },
    sources: [orderSourceOf(detail.orderNo)],
  };
}

export const notFoundOrder = (): ToolOutput<OrderResult> => ({
  result: { found: false, message: NO_SUCH_ORDER },
  sources: [],
});
