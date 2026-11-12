import { planCatalogue } from "./catalogue-plan.js";
import { addressOf, taxIdOf } from "./places.js";
import type {
  Customer,
  Item,
  OrderDocument,
  SampleOrder,
  SampleSpr,
  SyntheticDataset,
} from "./types.js";

/**
 * The cases the data plants on purpose, found by record rather than by a fixed
 * number, so a change to the data that loses one fails loudly. Each is a case
 * for the checks and the AI intake to find; none is an order status.
 */
export interface PlantedCases {
  /** A PO for 1,000 of an item with 640 in stock; the SPR is for the 360 missing. */
  shortStock: { order: SampleOrder; item: Item; spr: SampleSpr };
  /** A draft PI whose first line prints a higher price than the customer's PO. */
  piPriceMismatch: { order: SampleOrder };
  /** A draft air waybill that names a consignee one letter off the buyer. */
  wrongConsignee: { order: SampleOrder; document: OrderDocument };
  /** Customers of one country whose names differ by one letter, each with its own number and tax ID. */
  lookAlikes: readonly (readonly [Customer, Customer])[];
  /** A customer, and the way a PO may print its name: the same company, the same tax ID. */
  respelled: { customer: Customer; printedAs: string };
  /** A company that is not in master data, so a PO from it has no customer to match. */
  newCustomer: {
    name: string;
    countryRegionCode: "VN";
    address: ReturnType<typeof addressOf>;
    taxRegistrationNumber: string;
  };
}

function oneLetterApart(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let differences = 0;
  for (let at = 0; at < a.length; at++) if (a[at] !== b[at]) differences++;
  return differences === 1;
}

/** The same company as printed on a PO: capitals, with dots in the legal suffix. */
export function respelling(name: string): string {
  return name
    .toUpperCase()
    .replace(/\bPVT LTD$/, "PVT. LTD.")
    .replace(/\bPTE LTD$/, "PTE. LTD.")
    .replace(/\bLTD$/, "LTD.");
}

function found<T>(value: T | undefined, what: string): T {
  if (value === undefined) throw new Error(`The data plants no ${what}`);
  return value;
}

export function plantedCases(dataset: SyntheticDataset): PlantedCases {
  const plantedAt = planCatalogue().findIndex((plan) => plan.plantedShort);
  const item = found(dataset.items[plantedAt], "short-stock item");
  const shortOrder = found(
    dataset.orders.find(
      (order) =>
        order.scenario.kind === "short-stock" &&
        order.scenario.itemNo === item.no,
    ),
    "short-stock order",
  );
  const spr = found(
    dataset.sprs.find(
      (candidate) => candidate.orderNo === shortOrder.header.no,
    ),
    "short-stock SPR",
  );
  const piOrder = found(
    dataset.orders.find((order) => order.scenario.kind === "pi-price-mismatch"),
    "PI price mismatch",
  );
  let consigneeOrder: SampleOrder | undefined;
  let consigneeDocument: OrderDocument | undefined;
  for (const order of dataset.orders) {
    const document = order.documents.find(
      (candidate) => candidate.consignee !== undefined,
    );
    if (document) {
      consigneeOrder = order;
      consigneeDocument = document;
      break;
    }
  }
  const pairs: [Customer, Customer][] = [];
  dataset.customers.forEach((a, at) => {
    for (const b of dataset.customers.slice(at + 1)) {
      if (
        a.countryRegionCode === b.countryRegionCode &&
        oneLetterApart(a.name, b.name)
      )
        pairs.push([a, b]);
    }
  });
  if (pairs.length === 0) throw new Error("The data plants no look-alikes");
  const customer = found(dataset.customers[0], "customer");
  return {
    shortStock: { order: shortOrder, item, spr },
    piPriceMismatch: { order: piOrder },
    wrongConsignee: {
      order: found(consigneeOrder, "wrong consignee order"),
      document: found(consigneeDocument, "wrong consignee document"),
    },
    lookAlikes: pairs,
    respelled: { customer, printedAs: respelling(customer.name) },
    newCustomer: {
      name: "Mekong Sample Distribution Co Ltd",
      countryRegionCode: "VN",
      // One past the last customer, so it is a number master data does not hold.
      address: addressOf(dataset.customers.length + 1, "VN"),
      taxRegistrationNumber: taxIdOf(dataset.customers.length + 1, "VN"),
    },
  };
}
