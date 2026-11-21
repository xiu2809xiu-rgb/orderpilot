import {
  orderResultSchema,
  ordersResultSchema,
  stockResultSchema,
  type OrderResult,
  type OrdersResult,
  type Price,
  type StockResult,
} from "./tools/spark-tool-results.js";

// The sentences the offline mock says. Each is built from the result a tool
// gave, read back through the schema the tool wrote it with, and never from a
// figure written down here: a stock count that changes in the data changes
// here with it. The mock is a stand-in for a model, so it states only what a
// tool returned and says plainly when there is nothing to state.

export const SPARK_CANNOT_REPLY =
  "I can look up the stock of an item, find orders, and read one order. I cannot answer that one, and I do not guess. Try asking about stock, for example: How many HP monitors do we have?";
export const SPARK_REFUSED_REPLY =
  "I could not look that up for you, so I have no answer to give. I do not guess.";
export const SPARK_UNREADABLE_REPLY =
  "I could not read what the lookup returned, so I have no answer to give. I do not guess.";

/** 1020 as "1,020" and "880.00" as "880": the way a person reads a quantity. */
function plain(value: string): string {
  const number = Number(value);
  return Number.isFinite(number)
    ? number.toLocaleString("en-US", { maximumFractionDigits: 2 })
    : value;
}

function moneyOf(price: Price): string {
  return "hidden" in price
    ? "hidden for your role"
    : `${plain(price.value)} ${price.currency}`;
}

/**
 * The text between the fence the tool loop wraps a result in. It does not rely
 * on the nonce: it takes whatever id the opening and closing lines carry. A
 * result the loop cut is not valid JSON, and reads as nothing.
 */
const FENCED =
  /^<untrusted-data id="[A-Za-z0-9]+" label="[^"]*">\n([\s\S]*)\n<\/untrusted-data id="[A-Za-z0-9]+">$/;

export function unfenced(output: string): unknown {
  const body = FENCED.exec(output.trim())?.[1];
  if (body === undefined) return undefined;
  try {
    return JSON.parse(body) as unknown;
  } catch {
    return undefined;
  }
}

function itemSentence(
  item: Extract<StockResult, { found: true }>["items"][number],
): string {
  return `${item.description} (${item.itemNo}, part ${item.partNumber}): ${plain(item.onHand)} on hand and ${plain(item.onSalesOrders)} on sales orders. ${plain(item.onPurchaseOrders)} more are on purchase orders, so ${plain(item.available)} are available.`;
}

export function stockSentenceOf(data: unknown): string {
  const parsed = stockResultSchema.safeParse(data);
  if (!parsed.success) return SPARK_UNREADABLE_REPLY;
  const result: StockResult = parsed.data;
  if (!result.found) return result.message;
  const head =
    result.items.length === 1
      ? "One item matches. "
      : `${String(result.matched)} items match${result.matched > result.items.length ? `; these are the first ${String(result.items.length)}` : ""}. `;
  return head + result.items.map(itemSentence).join(" ");
}

function orderRowSentence(
  order: Extract<OrdersResult, { found: true }>["orders"][number],
): string {
  const who = order.customerName ?? order.customerNo;
  const state = order.status ?? order.captureState ?? "no state yet";
  const short =
    order.shortageCount > 0
      ? `, short of stock on ${String(order.shortageCount)} item${order.shortageCount === 1 ? "" : "s"}`
      : "";
  return `${order.orderNo} for ${who}, dated ${order.orderDate}, ${state}, amount ${moneyOf(order.amount)}${short}.`;
}

export function ordersSentenceOf(data: unknown): string {
  const parsed = ordersResultSchema.safeParse(data);
  if (!parsed.success) return SPARK_UNREADABLE_REPLY;
  const result: OrdersResult = parsed.data;
  if (!result.found) return result.message;
  const head = `${String(result.matched)} order${result.matched === 1 ? "" : "s"} match${result.matched > result.orders.length ? `; these are the ${String(result.orders.length)} most recent` : ""}. `;
  return head + result.orders.map(orderRowSentence).join(" ");
}

export function orderSentenceOf(data: unknown): string {
  const parsed = orderResultSchema.safeParse(data);
  if (!parsed.success) return SPARK_UNREADABLE_REPLY;
  const result: OrderResult = parsed.data;
  if (!result.found) return result.message;
  const { order } = result;
  const lines = `It has ${String(order.lineCount)} line${order.lineCount === 1 ? "" : "s"}.`;
  return `${orderRowSentence(order)} ${lines}`;
}
