import {
  addDecimal,
  multiplyDecimal,
  roundToCents,
  type NavisionStatus,
  type SalesLine,
} from "@orderpilot/shared";
import {
  PLANTED_STOCK,
  isLowStockIndex,
  supportsInRotation,
} from "./catalogue.js";
import { FIRST_CUSTOMER_COUNT, PREPAYMENT_PERCENT } from "./names.js";
import { addDays, daysBetween } from "./dates.js";
import { makeDocuments, type DocumentFactory } from "./documents.js";
import type { Journey } from "./journey.js";
import { planCatalogue } from "./catalogue-plan.js";
import { agreedPrice } from "./last-price.js";
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

/** Under the mock approver's purchase limit of 5,000.00, with room to spare. */
const APPROVER_PURCHASE_LIMIT = 4_900;

/** How far short the planted order is: 1,000 asked for, `PLANTED_STOCK` on hand. */
const PLANTED_SHORT_BY = 1_000 - PLANTED_STOCK;

/** A name one letter off: the first vowel after the first letter becomes the next vowel. */
export function lookAlikeName(name: string): string {
  const vowels = "aeiou";
  for (let at = 1; at < name.length; at++) {
    const letter = name[at] ?? "";
    const next = vowels.indexOf(letter);
    if (next >= 0) {
      return `${name.slice(0, at)}${vowels[(next + 1) % vowels.length] ?? ""}${name.slice(at + 1)}`;
    }
  }
  return `${name.slice(0, -1)}${name.endsWith("x") ? "z" : "x"}`;
}

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
  seed: number;
  reference: string;
  customers: readonly Customer[];
  items: readonly Item[];
  brands: readonly Brand[];
  people: readonly Person[];
  journeys: readonly Journey[];
  documents: DocumentFactory;
}

/** A sales line the way every generated order writes it. */
export function line(
  item: Item,
  quantity: string,
  shipped: boolean,
  unitPrice: string,
): SalesLine {
  return {
    type: "Item",
    no: item.no,
    description: item.description,
    quantity,
    unitPrice,
    lineAmount: multiplyDecimal(quantity, unitPrice),
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

function usualQuantities(index: number): readonly number[] {
  return planCatalogue()[index]?.productClass.quantities ?? [10];
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
    /** True for the one draft PI that prints a higher price than its PO. */
    piMismatch: boolean;
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
        amountDue: roundToCents(
          multiplyDecimal(
            order.total,
            (Number(order.percent) / 100).toFixed(4),
          ),
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
    case "sample-pi-to-send":
      return order.piMismatch
        ? {
            kind: "pi-price-mismatch",
            itemNo: first.no,
            poPrice: first.unitPrice,
            piPrice: addDecimal(
              first.unitPrice,
              Number(first.unitPrice) < 20 ? "0.50" : "1.50",
            ),
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
  const { random, seed, reference, customers, items, journeys } = inputs;
  const names = (role: Person["role"]) =>
    inputs.people.filter((p) => p.role === role).map((p) => p.name);
  const supports = supportsInRotation(inputs.people);
  const warehouses = names("WAREHOUSE");
  const finances = names("FINANCE");
  const logistics = names("LOGISTICS");
  const approver = names("APPROVER")[0] ?? "";
  const ownerOfBrand = new Map(inputs.brands.map((b) => [b.name, b.owner]));
  const allIndexes = items.map((_, i) => i);
  const shortPool = shuffled(random, allIndexes.filter(isLowStockIndex));
  // The planted flash drive is kept out of ordinary lines, so nothing else
  // draws down the stock the short-stock case counts on.
  const plantedAt = planCatalogue().findIndex((plan) => plan.plantedShort);
  const planted = items[plantedAt];
  if (!planted) throw new Error("The catalogue plants no short-stock item");
  const normalPool = allIndexes.filter(
    (i) => !isLowStockIndex(i) && i !== plantedAt,
  );
  const prepays = (c: Customer): boolean =>
    PREPAYMENT_PERCENT[c.paymentTermsCode] !== undefined;
  // What is pinned across the data sets is only each order's number, state,
  // age, SPR and PI numbers and the first forty customers; the buyer, owner and
  // documents of most orders did change once. The pick draws over the first
  // forty only, and the customers after them reach an order through the
  // newcomer slot below.
  const firstCustomers = customers.slice(0, FIRST_CUSTOMER_COUNT);
  const prepayCustomers = firstCustomers.filter(prepays);
  const newcomers = customers.slice(FIRST_CUSTOMER_COUNT);
  const newcomerCountries = [
    ...new Set(newcomers.map((c) => c.countryRegionCode)),
  ];
  let nextNewcomer = 0;
  const pickCustomer = (pool: readonly Customer[]): Customer => {
    // Squaring the draw favours the first customers, so a few accounts have many orders.
    const customer = pool[Math.floor(random.next() ** 1.5 * pool.length)];
    if (!customer) throw new Error("Orders need customers");
    return customer;
  };
  let nextShort = 0;
  let plantedUsed = false;
  let piMismatchUsed = false;
  let consigneeUsed = false;
  // Open quantity per item that the stock already has to cover. The short
  // line of an order waiting for a purchase request is not counted: it is the
  // demand under review, and the request's own formula weighs it.
  const reserved = new Map<string, number>();

  const orders = journeys.map((j, i): SampleOrder => {
    const rank = SAMPLE_SCREEN_STATES.indexOf(j.state);
    const shipped = rank >= 8;
    const picked = pickCustomer(
      j.state === "sample-awaiting-payment" ? prepayCustomers : firstCustomers,
    );
    // Every tenth order, from the eighth, goes to a customer in one of the six
    // newer countries, in turn, so each has live orders. One waiting for a
    // payment goes to a customer who prepays.
    let customer = picked;
    if (i % 10 === 7 && newcomerCountries.length > 0) {
      const turn = nextNewcomer++;
      const country = newcomerCountries[turn % newcomerCountries.length];
      const inCountry = newcomers.filter(
        (c) =>
          c.countryRegionCode === country &&
          (j.state !== "sample-awaiting-payment" || prepays(c)),
      );
      const chosen =
        inCountry[
          Math.floor(turn / newcomerCountries.length) % inCountry.length
        ];
      if (chosen) customer = chosen;
    }
    const lines: SalesLine[] = [];
    let shortfall: SampleOrder["stockShortfall"] = null;
    let shortItem: Item | undefined;

    if (j.hasSpr) {
      const at = shortPool[nextShort++];
      shortItem = at === undefined ? undefined : items[at];
      if (!shortItem)
        throw new Error("Not enough low-stock items for the SPRs");
      // The first order short on stock is the planted case. It still takes
      // its slot in the pool and its draw, so the other orders do not move.
      const usePlanted = !plantedUsed && j.state === "sample-short-stock";
      if (usePlanted) {
        plantedUsed = true;
        shortItem = planted;
      }
      const available = availableStock(shortItem);
      // Kept inside the approver's purchase limit, so a request she approved
      // never contradicts the limit the SPR page shows.
      const affordable = Math.floor(
        APPROVER_PURCHASE_LIMIT / Number(shortItem.unitCost),
      );
      const drawn = random.int(2, 20) * 10;
      const shortBy = usePlanted
        ? PLANTED_SHORT_BY
        : Math.max(1, Math.min(drawn, affordable));
      const ordered = String(Number(available) + shortBy);
      lines.push(
        line(
          shortItem,
          ordered,
          shipped,
          agreedPrice(seed, customer, shortItem),
        ),
      );
      shortfall = {
        itemNo: shortItem.no,
        ordered,
        availableStock: available,
        shortBy: addDecimal(ordered, `-${available}`),
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
      const room = Math.floor(
        (Number(availableStock(item)) - (reserved.get(item.no) ?? 0)) / 2,
      );
      if (room < 1) continue;
      used.add(at);
      const usual = random.pick(usualQuantities(at));
      const quantity = Math.max(1, Math.min(usual, room));
      lines.push(
        line(
          item,
          String(quantity),
          shipped,
          agreedPrice(seed, customer, item),
        ),
      );
      if (!shipped)
        reserved.set(item.no, (reserved.get(item.no) ?? 0) + quantity);
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
    const piMismatch = j.state === "sample-pi-to-send" && !piMismatchUsed;
    if (piMismatch) piMismatchUsed = true;
    const scenario = scenarioFor(j, lines, {
      total,
      percent,
      transport,
      shortfall,
      shortItem,
      reference,
      piMismatch,
    });
    // The first order at picking that goes by air has a draft air waybill
    // naming a consignee one letter off the buyer: a case for the checks.
    const wrongConsignee =
      !consigneeUsed && j.state === "sample-ready-to-pick" && i % 2 === 0
        ? {
            consignee: lookAlikeName(customer.name),
            notifyParty: customer.name,
          }
        : undefined;
    if (wrongConsignee) consigneeUsed = true;

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
        wrongConsignee,
      },
      inputs.documents,
    );
    return {
      header,
      shipTo: {
        name: customer.name,
        addressLine1: customer.addressLine1,
        addressLine2: customer.addressLine2,
        city: customer.city,
        postalCode: customer.postalCode,
        countryRegionCode: customer.countryRegionCode,
      },
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
  // Qty. on Sales Order is the sum of these open lines. A short line joins it
  // once its SPR is approved, when the purchase orders are made.
  for (const item of items) {
    const open = reserved.get(item.no);
    if (open)
      item.qtyOnSalesOrder = String(Number(item.qtyOnSalesOrder) + open);
  }
  return orders;
}
