import { addDecimal, multiplyDecimal, sumDecimal } from "@orderpilot/shared";
import { priceMismatchText } from "./exceptions.js";
import { line } from "./orders.js";
import { availableStock } from "./stock.js";
import type {
  Customer,
  Item,
  SampleException,
  SampleOrder,
  SampleSpr,
  SampleTask,
  SyntheticDataset,
} from "./types.js";

/**
 * The one order the proposal demo follows, written once. Opt-in: the
 * generator never reads it, so the base set and every test of it stay as
 * they were (see `withDemoStoryline`).
 */
export const STORYLINE = {
  /** A new customer. Every field but these is copied from the order's present customer. */
  customer: {
    no: "C-1042",
    name: "Meridian Vale Technologies Pvt Ltd",
  },
  /** The generated order that is short of stock, with its suggested SPR. */
  shortOrder: {
    orderNo: "SO-0082",
    poNumber: "4471-26",
    itemNo: "I-0075",
    quantity: "1000",
    unitPrice: "61.20",
  },
  /** The generated order whose PI prints a higher price than its PO. */
  priceOrder: {
    orderNo: "SO-0069",
    itemNo: "I-0075",
    poPrice: "61.20",
    piPrice: "64.80",
  },
} as const;

function required<T>(value: T | undefined, what: string): T {
  if (value === undefined) throw new Error(`The storyline needs ${what}`);
  return value;
}

/** Whole units, written the way the catalogue writes stock figures. */
const units = (value: string): string => String(Number(value));

/**
 * Qty. on Sales Order is the sum of the open lines, so a line that moves to
 * another item takes its quantity with it. The short line of a suggested SPR
 * is not counted: it is the demand under review.
 */
function moveDemand(
  items: readonly Item[],
  itemNo: string,
  quantity: string,
  direction: 1 | -1,
): void {
  const item = required(
    items.find((candidate) => candidate.no === itemNo),
    `item ${itemNo}`,
  );
  item.qtyOnSalesOrder = String(
    Number(item.qtyOnSalesOrder) + direction * Number(quantity),
  );
}

function changeShortOrder(
  copy: SyntheticDataset,
  customer: Customer,
  item: Item,
): void {
  const story = STORYLINE.shortOrder;
  const order = required(
    copy.orders.find((o) => o.header.no === story.orderNo),
    story.orderNo,
  );
  // The other lines go, and with them their share of the items' open demand.
  // The short line was never counted in it: it is the demand under review.
  for (const gone of order.lines)
    if (gone.no !== order.stockShortfall?.itemNo)
      moveDemand(copy.items, gone.no, gone.quantity, -1);
  order.header.sellToCustomerNo = customer.no;
  order.header.externalDocumentNo = story.poNumber;
  order.shipTo.name = customer.name;
  order.lines = [line(item, story.quantity, false, story.unitPrice)];
  order.total = sumDecimal(order.lines.map((l) => l.lineAmount));
  const productManager = required(
    copy.brands.find((brand) => brand.name === item.brand),
    `the brand ${item.brand}`,
  ).owner;
  order.owners.productManager = productManager;
  for (const document of order.documents) {
    if (document.type !== "CUSTOMER_PO") continue;
    document.number = story.poNumber;
    document.fileName = `${story.poNumber}.pdf`;
  }
  const available = availableStock(item);
  const shortBy = addDecimal(story.quantity, `-${available}`);
  if (Number(shortBy) <= 0)
    throw new Error("The storyline item must be short of stock");
  order.stockShortfall = {
    itemNo: item.no,
    ordered: story.quantity,
    availableStock: available,
    shortBy,
  };
  order.scenario = {
    kind: "short-stock",
    itemNo: item.no,
    ordered: story.quantity,
    inStock: units(available),
    shortBy,
    suggestedSpr: {
      vendorNo: item.vendorNo,
      itemNo: item.no,
      quantity: shortBy,
    },
  };
  changeSpr(copy, order, item, available, shortBy);
  for (const task of copy.tasks)
    if (task.orderNo === order.header.no) changeTask(task, order, copy);
}

function changeSpr(
  copy: SyntheticDataset,
  order: SampleOrder,
  item: Item,
  available: string,
  shortBy: string,
): void {
  const spr: SampleSpr = required(
    copy.sprs.find((s) => s.orderNo === order.header.no),
    `the SPR of ${order.header.no}`,
  );
  spr.itemNo = item.no;
  spr.vendorNo = item.vendorNo;
  spr.requestedBy = order.owners.productManager;
  spr.quantity = shortBy;
  spr.unitCost = item.unitCost;
  spr.amount = multiplyDecimal(shortBy, item.unitCost);
  spr.basis = {
    ordered: STORYLINE.shortOrder.quantity,
    inventory: item.inventory,
    qtyOnSalesOrder: item.qtyOnSalesOrder,
    qtyOnPurchOrder: item.qtyOnPurchOrder,
    availableStock: available,
    shortfall: shortBy,
  };
}

/** What a task carries from its order: the buyer, the holder and, for an SPR task, the request's amount. */
function changeTask(
  task: SampleTask,
  order: SampleOrder,
  copy: SyntheticDataset,
): void {
  const customer = required(
    copy.customers.find((c) => c.no === order.header.sellToCustomerNo),
    `customer ${order.header.sellToCustomerNo}`,
  );
  task.customerNo = customer.no;
  task.customerName = customer.name;
  if (task.kind === "RAISE_SPR") {
    task.assigneeName = order.owners.productManager;
    task.amount = required(
      copy.sprs.find((s) => s.orderNo === order.header.no),
      `the SPR of ${order.header.no}`,
    ).amount;
  } else {
    task.amount = order.total;
  }
}

function changePriceOrder(copy: SyntheticDataset, item: Item): void {
  const story = STORYLINE.priceOrder;
  const order = required(
    copy.orders.find((o) => o.header.no === story.orderNo),
    story.orderNo,
  );
  const first = required(order.lines[0], `a first line on ${story.orderNo}`);
  moveDemand(copy.items, first.no, first.quantity, -1);
  moveDemand(copy.items, item.no, first.quantity, 1);
  order.lines[0] = line(item, first.quantity, false, story.poPrice);
  order.total = sumDecimal(order.lines.map((l) => l.lineAmount));
  order.owners.productManager = required(
    copy.brands.find((brand) => brand.name === item.brand),
    `the brand ${item.brand}`,
  ).owner;
  const scenario = {
    kind: "pi-price-mismatch" as const,
    itemNo: item.no,
    poPrice: story.poPrice,
    piPrice: story.piPrice,
  };
  order.scenario = scenario;
  const exception: SampleException = required(
    copy.exceptions.find(
      (e) => e.orderNo === order.header.no && e.ruleId === "mock.sample-price",
    ),
    `the price exception of ${order.header.no}`,
  );
  Object.assign(exception, priceMismatchText(scenario));
  for (const task of copy.tasks)
    if (task.orderNo === order.header.no) changeTask(task, order, copy);
}

/**
 * A deep copy of a generated dataset with the demo's storyline in it: the
 * order short of stock is a 1,000-unit PO from a new customer, and the
 * order with the PI price mismatch has the same item at 61.20 against 64.80.
 * Everything those two orders feed (tasks, the SPR, the exception, the items'
 * open demand, the customer list) is changed to match; nothing else moves.
 * The input is left as it was.
 */
export function withDemoStoryline(dataset: SyntheticDataset): SyntheticDataset {
  const copy = structuredClone(dataset);
  const shortOrder = required(
    copy.orders.find((o) => o.header.no === STORYLINE.shortOrder.orderNo),
    STORYLINE.shortOrder.orderNo,
  );
  const present = required(
    copy.customers.find((c) => c.no === shortOrder.header.sellToCustomerNo),
    `customer ${shortOrder.header.sellToCustomerNo}`,
  );
  const customer: Customer = { ...present, ...STORYLINE.customer };
  copy.customers.push(customer);
  copy.openingBalances.receivablesLcy = addDecimal(
    copy.openingBalances.receivablesLcy,
    customer.balanceLcy,
  );
  const item = required(
    copy.items.find((i) => i.no === STORYLINE.shortOrder.itemNo),
    `item ${STORYLINE.shortOrder.itemNo}`,
  );
  // The price order moves its demand onto the item first, so the shortfall
  // below is worked out from the stock figures the screens will show.
  changePriceOrder(copy, item);
  changeShortOrder(copy, customer, item);
  return copy;
}
