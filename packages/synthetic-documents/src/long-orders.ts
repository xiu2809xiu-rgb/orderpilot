import { addDecimal, multiplyDecimal } from "@orderpilot/shared";
import {
  AS_OF,
  addDays,
  agreedPrice,
  plantedCases,
  type Item,
  type OrderDocument,
  type PurchaseOrder,
  type SampleOrder,
  type SyntheticDataset,
} from "@orderpilot/synthetic-data";
import { layoutForCustomer } from "./facts-data.js";
import type { PoLayout } from "./model.js";
import { find } from "./pinned.js";

/**
 * Orders far longer than any the data holds, for the tables that run over
 * several pages. They live beside the dataset, never in it, and carry no `SO-`
 * number, so nothing that counts or looks up the 120 live orders can see them.
 * The line counts are chosen so that every PO runs onto a second page in its
 * own layout, and the longest takes three pages in Spectra's house look.
 */
export interface LongOrderSpec {
  no: string;
  lines: number;
  /** How the customer's PO looks: the customer is the first with this look and these terms. */
  layout: Extract<PoLayout, "table" | "boxed">;
  terms: string;
}

export const LONG_ORDERS: readonly LongOrderSpec[] = [
  { no: "LS-0001", lines: 48, layout: "table", terms: "30 DAYS" },
  { no: "LS-0002", lines: 34, layout: "boxed", terms: "30% DEPOSIT" },
  { no: "LS-0003", lines: 70, layout: "table", terms: "50% ADVANCE" },
  { no: "LS-0004", lines: 90, layout: "boxed", terms: "30 DAYS" },
];

// The share paid before shipping under each terms code, as the data holds it.
const PREPAID_SHARE: Readonly<Record<string, string>> = {
  PREPAID: "100",
  "50% ADVANCE": "50",
  "30% DEPOSIT": "30",
};

// Days before the reference date that each step of a long order was done.
// Fixed, so the order is the same on any day.
const STEPS = {
  ordered: 75,
  pi: 71,
  paid: 66,
  packed: 60,
  shipped: 57,
  invoiced: 54,
  closed: 40,
} as const;

const day = (back: number): string => addDays(AS_OF, -back);
const at = (date: string, hour: number): string =>
  `${date}T${String(hour).padStart(2, "0")}:00:00.000Z`;
const digits = (no: string): string => no.slice(3);

/** The item for line `k`: a stride coprime to the catalogue, so no item repeats. */
function itemsFor(dataset: SyntheticDataset, count: number): Item[] {
  const skip = plantedCases(dataset).shortStock.item.no;
  const chosen: Item[] = [];
  const used = new Set<number>();
  for (let k = 0; chosen.length < count; k++) {
    let index = (k * 7) % dataset.items.length;
    while (used.has(index) || dataset.items[index]?.no === skip) {
      index = (index + 1) % dataset.items.length;
    }
    used.add(index);
    const item = dataset.items[index];
    if (!item) throw new Error(`The data has no item ${String(index)}`);
    chosen.push(item);
  }
  return chosen;
}

const quantityOf = (k: number): string => String(10 * (1 + ((k * 7) % 9)));

function documentsOf(
  order: string,
  confirmedBy: string,
  po: string,
): OrderDocument[] {
  const id = digits(order);
  const doc = (
    type: OrderDocument["type"],
    number: string,
    when: string,
    hour: number,
    source: OrderDocument["source"],
  ): OrderDocument => ({
    id: `${order}-${type}`,
    orderNo: order,
    type,
    number,
    fileName: `${number}.pdf`,
    status: "confirmed",
    source,
    receivedAt: at(when, hour),
    dueDate: null,
    confirmedBy,
  });
  return [
    doc("CUSTOMER_PO", po, day(STEPS.ordered), 2, "email"),
    // Explicit numbers: without them a PI would take its number from the order
    // number, and PL-0001 belongs to SO-0001.
    doc(
      "PROFORMA_INVOICE",
      `PI-${day(STEPS.pi).replaceAll("-", "")}-9${id.slice(1)}`,
      day(STEPS.pi),
      3,
      "orderpilot",
    ),
    doc("PACKING_LIST", `PL-LS${id}`, day(STEPS.packed), 4, "upload"),
    doc("SALES_INVOICE", `SI-LS${id}`, day(STEPS.invoiced), 5, "navision"),
  ];
}

const made = new WeakMap<SyntheticDataset, SampleOrder[]>();

/** The long orders of a dataset: complete, closed, and not in `dataset.orders`. */
export function longOrders(dataset: SyntheticDataset): SampleOrder[] {
  const cached = made.get(dataset);
  if (cached) return cached;
  const person = (role: string): string =>
    find(dataset.people, (p) => p.role === role, `${role} on the team`).name;
  const orders = LONG_ORDERS.map((spec, n): SampleOrder => {
    const customer = find(
      dataset.customers,
      (c) =>
        layoutForCustomer(c.no) === spec.layout &&
        c.paymentTermsCode === spec.terms,
      `customer with a ${spec.layout} PO on ${spec.terms}`,
    );
    const lines = itemsFor(dataset, spec.lines).map((item, k) => {
      const unitPrice = agreedPrice(dataset.seed, customer, item);
      const quantity = quantityOf(k);
      const lineAmount = multiplyDecimal(quantity, unitPrice);
      return {
        type: "Item" as const,
        no: item.no,
        description: item.description,
        quantity,
        unitPrice,
        lineAmount,
        qtyToShip: "0",
        quantityShipped: quantity,
      };
    });
    const po = `PO-${customer.countryRegionCode}-${String(4001 + n)}`;
    const percent = PREPAID_SHARE[customer.paymentTermsCode] ?? "0";
    return {
      header: {
        no: spec.no,
        sellToCustomerNo: customer.no,
        externalDocumentNo: po,
        orderDate: day(STEPS.ordered),
        shipmentDate: day(STEPS.shipped),
        currencyCode: "USD",
        prepaymentPercent: percent,
        shipmentMethodCode: n % 2 === 0 ? "FOB" : "CIF",
        shippingAgentCode: "DEMO-FORWARDER",
        packageTrackingNo: `AWB-DEMO-${String(900 + n).padStart(6, "0")}`,
        navisionStatus: "Released",
      },
      shipTo: {
        name: customer.name,
        addressLine1: customer.addressLine1,
        addressLine2: customer.addressLine2,
        city: customer.city,
        postalCode: customer.postalCode,
        countryRegionCode: customer.countryRegionCode,
      },
      lines,
      sampleScreenState: "sample-closed",
      scenario: { kind: "none" },
      total: lines.reduce((sum, l) => addDecimal(sum, l.lineAmount), "0.00"),
      ageDays: STEPS.ordered,
      priority: "low",
      owners: {
        support: person("SUPPORT"),
        productManager: person("PRODUCT_MANAGER"),
        approver: person("APPROVER"),
        finance: person("FINANCE"),
        warehouse: person("WAREHOUSE"),
        logistics: person("LOGISTICS"),
      },
      documents: documentsOf(spec.no, person("SUPPORT"), po),
      step: { enteredOn: day(STEPS.closed), dueOn: null },
      milestones: {
        fields: day(STEPS.ordered),
        stock: day(STEPS.ordered),
        approved: day(STEPS.ordered),
        pi: day(STEPS.pi),
        paid: day(STEPS.paid),
        packed: day(STEPS.packed),
        shipped: day(STEPS.shipped),
        invoiced: day(STEPS.invoiced),
        closed: day(STEPS.closed),
      },
      stockShortfall: null,
    };
  });
  made.set(dataset, orders);
  return orders;
}

const madePurchase = new WeakMap<SyntheticDataset, PurchaseOrder[]>();

/** One purchase order for every item of the vendor with the most items: a long vendor invoice hangs on it. */
export function longPurchaseOrders(dataset: SyntheticDataset): PurchaseOrder[] {
  const cached = madePurchase.get(dataset);
  if (cached) return cached;
  const count = new Map<string, number>();
  for (const item of dataset.items) {
    count.set(item.vendorNo, (count.get(item.vendorNo) ?? 0) + 1);
  }
  // The lowest number wins a tie, so the choice does not depend on map order.
  const [vendorNo] = [...count.entries()].sort(
    (a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1),
  )[0] ?? [""];
  const lines = dataset.items
    .filter((item) => item.vendorNo === vendorNo)
    .map((item, k) => {
      const quantity = quantityOf(k);
      return {
        no: item.no,
        description: item.description,
        quantity,
        outstandingQuantity: quantity,
        unitCost: item.unitCost,
        lineAmount: multiplyDecimal(quantity, item.unitCost),
      };
    });
  const orders: PurchaseOrder[] = [
    {
      no: "LP-0001",
      buyFromVendorNo: vendorNo,
      orderDate: day(20),
      expectedReceiptDate: addDays(AS_OF, 10),
      currencyCode: "USD",
      status: "open",
      sprRecordNo: null,
      lines,
      total: lines.reduce((sum, l) => addDecimal(sum, l.lineAmount), "0.00"),
    },
  ];
  madePurchase.set(dataset, orders);
  return orders;
}
