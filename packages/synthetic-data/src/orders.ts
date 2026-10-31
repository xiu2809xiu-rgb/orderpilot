import {
  addDecimal,
  multiplyDecimal,
  type NavisionStatus,
  type SalesLine,
} from "@orderpilot/shared";
import { isLowStockIndex } from "./catalogue.js";
import { addDays, daysBetween } from "./dates.js";
import { makeDocuments, type DocumentFactory } from "./documents.js";
import type { Journey } from "./journey.js";
import { PREPAYMENT_PERCENT, PRODUCTS } from "./names.js";
import { priorityOf } from "./priority.js";
import type { SeededRandom } from "./random.js";
import { availableStock } from "./stock.js";
import {
  SAMPLE_SCREEN_STATES,
  type Brand,
  type Customer,
  type Item,
  type OrderOwners,
  type Person,
  type SampleOrder,
  type SampleScenario,
  type SampleScreenState,
} from "./types.js";

const NAVISION_STATUS: Readonly<
  Record<SampleScreenState, NavisionStatus | null>
> = {
  "sample-po-received": null,
  "sample-extracted-awaiting-review": "Open",
  "sample-short-stock": "Open",
  "sample-pending-approval": "Pending Approval",
  "sample-pi-to-send": "Open",
  "sample-awaiting-payment": "Pending Prepayment",
  "sample-ready-to-pick": "Released",
  "sample-packing-list-mismatch": "Released",
  "sample-awb-overdue": "Released",
  "sample-shipped": "Released",
  "sample-invoiced": "Released",
  "sample-closed": "Released",
};

const pad = (n: number, width = 4): string => String(n).padStart(width, "0");

export interface OrderInputs {
  random: SeededRandom;
  reference: string;
  customers: readonly Customer[];
  items: readonly Item[];
  brands: readonly Brand[];
  people: readonly Person[];
  journeys: readonly Journey[];
  documents: DocumentFactory;
}

function line(item: Item, quantity: string, shipped: boolean): SalesLine {
  return {
    type: "Item",
    no: item.no,
    description: item.description,
    quantity,
    unitPrice: item.unitPrice,
    lineAmount: multiplyDecimal(quantity, item.unitPrice),
    qtyToShip: shipped ? "0" : quantity,
    quantityShipped: shipped ? quantity : "0",
  };
}

/** Shuffled in place, so low-stock items are handed out in a stable but mixed order. */
function shuffled(random: SeededRandom, values: number[]): number[] {
  for (let i = values.length - 1; i > 0; i--) {
    const j = random.int(0, i);
    const a = values[i] ?? 0;
    values[i] = values[j] ?? 0;
    values[j] = a;
  }
  return values;
}

function usualQuantities(item: Item, index: number): readonly number[] {
  const products = PRODUCTS[item.category];
  return products[(index % 25) % products.length]?.quantities ?? [10];
}

function scenarioFor(
  j: Journey,
  lines: readonly SalesLine[],
  order: {
    total: string;
    percent: string;
    transport: "AWB" | "BILL_OF_LADING";
    shortfall: SampleOrder["stockShortfall"];
    shortItem: Item | undefined;
    reference: string;
  },
): SampleScenario {
  const first = lines[0];
  if (!first) return { kind: "none" };
  const { shortfall } = order;
  switch (j.state) {
    case "sample-short-stock":
      if (!shortfall) return { kind: "none" };
      return {
        kind: "short-stock",
        itemNo: shortfall.itemNo,
        ordered: shortfall.ordered,
        inStock: order.shortItem?.inventory ?? "0",
        shortBy: shortfall.shortBy,
        suggestedSpr: {
          vendorNo: order.shortItem?.vendorNo ?? "",
          itemNo: shortfall.itemNo,
          quantity: shortfall.shortBy,
        },
      };
    case "sample-awaiting-payment":
      return {
        kind: "awaiting-payment",
        prepaymentPercent: order.percent,
        amountDue: multiplyDecimal(
          order.total,
          (Number(order.percent) / 100).toFixed(4),
        ),
      };
    case "sample-packing-list-mismatch": {
      const ordered = Number(first.quantity);
      return {
        kind: "packing-list-mismatch",
        itemNo: first.no,
        ordered: first.quantity,
        packed: String(ordered - Math.max(1, Math.floor(ordered / 10))),
      };
    }
    case "sample-extracted-awaiting-review":
      return j.indexInState % 2 === 0
        ? {
            kind: "price-mismatch",
            itemNo: first.no,
            printed: addDecimal(first.unitPrice, "-1.50"),
            listed: first.unitPrice,
          }
        : { kind: "none" };
    case "sample-awb-overdue":
      return j.dueOn
        ? {
            kind: "awb-overdue",
            documentType: order.transport,
            dueDate: j.dueOn,
            daysOverdue: daysBetween(j.dueOn, order.reference),
          }
        : { kind: "none" };
    case "sample-shipped":
      return j.dueOn && j.indexInState % 2 === 0
        ? { kind: "import-permit-missing", dueDate: j.dueOn }
        : { kind: "none" };
    default:
      return { kind: "none" };
  }
}

/**
 * The orders, one for each journey. Lines are chosen so that an ordinary line
 * never wants more than half of what is available, and an order with a stock
 * purchase request has one line that wants more than the item can cover.
 */
export function makeOrders(inputs: OrderInputs): SampleOrder[] {
  const { random, reference, customers, items, journeys } = inputs;
  const names = (role: Person["role"]) =>
    inputs.people.filter((p) => p.role === role).map((p) => p.name);
  const supports = names("SUPPORT");
  const warehouses = names("WAREHOUSE");
  const finances = names("FINANCE");
  const logistics = names("LOGISTICS");
  const approver = names("APPROVER")[0] ?? "";
  const ownerOfBrand = new Map(inputs.brands.map((b) => [b.name, b.owner]));
  const allIndexes = items.map((_, i) => i);
  const shortPool = shuffled(random, allIndexes.filter(isLowStockIndex));
  const normalPool = allIndexes.filter((i) => !isLowStockIndex(i));
  const prepayCustomers = customers.filter(
    (c) => PREPAYMENT_PERCENT[c.paymentTermsCode] !== undefined,
  );
  const pickCustomer = (pool: readonly Customer[]): Customer => {
    // Squaring the draw favours the first customers, so a few accounts have many orders.
    const customer = pool[Math.floor(random.next() ** 1.5 * pool.length)];
    if (!customer) throw new Error("Orders need customers");
    return customer;
  };
  let nextShort = 0;

  return journeys.map((j, i): SampleOrder => {
    const rank = SAMPLE_SCREEN_STATES.indexOf(j.state);
    const shipped = rank >= 8;
    const customer = pickCustomer(
      j.state === "sample-awaiting-payment" ? prepayCustomers : customers,
    );
    const lines: SalesLine[] = [];
    let shortfall: SampleOrder["stockShortfall"] = null;
    let shortItem: Item | undefined;

    if (j.hasSpr) {
      const at = shortPool[nextShort++];
      shortItem = at === undefined ? undefined : items[at];
      if (!shortItem)
        throw new Error("Not enough low-stock items for the SPRs");
      const available = availableStock(shortItem);
      const ordered = String(Number(available) + random.int(2, 20) * 10);
      const shortBy = addDecimal(ordered, `-${available}`);
      lines.push(line(shortItem, ordered, shipped));
      shortfall = {
        itemNo: shortItem.no,
        ordered,
        availableStock: available,
        shortBy,
      };
    }
    const wanted =
      (j.hasSpr ? random.int(0, 2) : random.int(1, 3)) + lines.length;
    const used = new Set<number>();
    const sum = () => lines.reduce((s, l) => s + Number(l.lineAmount), 0);
    // A distributor does not order a hundred dollars of goods: top up small orders.
    while (lines.length < wanted || (sum() < 1_500 && lines.length < 5)) {
      const at = normalPool[random.int(0, normalPool.length - 1)];
      const item = at === undefined ? undefined : items[at];
      if (at === undefined || !item || used.has(at)) continue;
      used.add(at);
      const room = Math.floor(Number(availableStock(item)) / 2);
      const usual = random.pick(usualQuantities(item, at));
      lines.push(
        line(item, String(Math.max(1, Math.min(usual, room))), shipped),
      );
    }
    const first = lines[0];
    if (!first) throw new Error("An order needs a line");
    const total = lines.reduce(
      (sum, l) => addDecimal(sum, l.lineAmount),
      "0.00",
    );
    const percent = PREPAYMENT_PERCENT[customer.paymentTermsCode] ?? "0";
    const transport =
      i % 2 === 0 ? ("AWB" as const) : ("BILL_OF_LADING" as const);
    const scenario = scenarioFor(j, lines, {
      total,
      percent,
      transport,
      shortfall,
      shortItem,
      reference,
    });

    // Shipped orders only have work waiting while a permit is missing, and
    // invoiced ones while a balance is still to come.
    let dueOn = j.dueOn;
    if (j.state === "sample-shipped" && scenario.kind === "none") dueOn = null;
    if (j.state === "sample-invoiced" && percent === "100") dueOn = null;

    const brand = items.find((it) => it.no === first.no)?.brand ?? "";
    const owners: OrderOwners = {
      support: supports[i % supports.length] ?? "",
      productManager: ownerOfBrand.get(shortItem?.brand ?? brand) ?? "",
      approver,
      finance: finances[i % finances.length] ?? "",
      warehouse: warehouses[i % warehouses.length] ?? "",
      logistics: logistics[i % logistics.length] ?? "",
    };
    const header: SampleOrder["header"] = {
      no: `SO-${pad(i + 1)}`,
      sellToCustomerNo: customer.no,
      externalDocumentNo: `PO-${customer.countryRegionCode}-${String(4100 + i * 7)}`,
      orderDate: j.orderDate,
      shipmentDate: shipped
        ? (j.done.shipped ?? null)
        : addDays(j.orderDate, random.int(10, 25)),
      currencyCode: "USD",
      prepaymentPercent: percent,
      shipmentMethodCode: i % 2 === 0 ? "FOB" : "CIF",
      shippingAgentCode: shipped ? "DEMO-FORWARDER" : null,
      packageTrackingNo:
        rank >= 9
          ? `${transport === "AWB" ? "AWB" : "BL"}-DEMO-${pad(100 + i * 7, 6)}`
          : null,
      navisionStatus: NAVISION_STATUS[j.state],
    };
    const documents = makeDocuments(
      {
        header,
        journey: j,
        owners,
        scenario,
        transport,
        invoiceNo: rank >= 10 ? `SI-${pad(100_000 + i, 6)}` : null,
      },
      inputs.documents,
    );
    return {
      header,
      lines,
      sampleScreenState: j.state,
      scenario,
      total,
      ageDays: j.ageDays,
      priority: priorityOf(total, dueOn, reference, j.indexInState % 6 === 2),
      owners,
      documents,
      step: { enteredOn: j.enteredOn, dueOn },
      milestones: { ...j.done },
      stockShortfall: shortfall,
    };
  });
}
