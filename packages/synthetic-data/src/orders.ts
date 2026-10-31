import {
  addDecimal,
  multiplyDecimal,
  type NavisionStatus,
  type SalesLine,
} from "@orderpilot/shared";
import { SHORT_STOCK_ITEM_INDEX } from "./catalogue.js";
import type { SeededRandom } from "./random.js";
import type {
  Customer,
  Item,
  SampleOrder,
  SampleScenario,
  SampleScreenState,
} from "./types.js";

/** "Today" in the data. Every date and overdue rule counts from here. */
export const AS_OF = "2026-11-02";

interface Plan {
  state: SampleScreenState;
  navisionStatus: NavisionStatus | null;
  orderDate: string;
  shipmentDate: string | null;
  prepaymentPercent: string;
  tracking: string | null;
  shipped: boolean;
}

function plan(
  state: SampleScreenState,
  navisionStatus: NavisionStatus | null,
  orderDate: string,
  shipmentDate: string | null,
  extra: Partial<Plan> = {},
): Plan {
  return {
    state,
    navisionStatus,
    orderDate,
    shipmentDate,
    prepaymentPercent: "0",
    tracking: null,
    shipped: false,
    ...extra,
  };
}

const PLANS: readonly Plan[] = [
  plan("sample-po-received", null, "2026-11-02", null),
  plan("sample-extracted-awaiting-review", "Open", "2026-11-01", null),
  plan("sample-short-stock", "Open", "2026-10-30", "2026-11-12"),
  plan(
    "sample-awaiting-payment",
    "Pending Prepayment",
    "2026-10-29",
    "2026-11-15",
    {
      prepaymentPercent: "50",
    },
  ),
  plan(
    "sample-pending-approval",
    "Pending Approval",
    "2026-10-28",
    "2026-11-10",
  ),
  plan("sample-ready-to-pick", "Released", "2026-10-27", "2026-11-06"),
  plan("sample-packing-list-mismatch", "Released", "2026-10-26", "2026-11-04"),
  plan("sample-awb-overdue", "Released", "2026-10-15", "2026-10-20", {
    shipped: true,
  }),
  plan("sample-shipped", "Released", "2026-10-12", "2026-10-25", {
    shipped: true,
    tracking: "AWB-DEMO-000123",
  }),
  plan("sample-invoiced", "Released", "2026-10-05", "2026-10-14", {
    shipped: true,
    tracking: "BL-DEMO-000456",
  }),
];

const SHORT_STOCK_ORDERED = "120";
const PACKED_SHORT_BY = "20";
const AWB_DUE_DATE = "2026-10-27";

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

function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000);
}

export function makeOrders(
  random: SeededRandom,
  customers: readonly Customer[],
  items: readonly Item[],
): SampleOrder[] {
  const shortItem = items[SHORT_STOCK_ITEM_INDEX];
  if (!shortItem) throw new Error("Orders need items");

  return PLANS.map((p, i): SampleOrder => {
    const customer = customers[i % customers.length];
    if (!customer) throw new Error("Orders need customers");
    const lines: SalesLine[] = [];
    let scenario: SampleScenario = { kind: "none" };

    if (p.state === "sample-short-stock") {
      // Prompt 002's formula: Inventory minus Qty. on Sales Order plus Qty. on
      // Purch. Order is what is available, and the shortfall is measured
      // against that, so the SPR screen and the data agree.
      const available = addDecimal(
        addDecimal(shortItem.inventory, `-${shortItem.qtyOnSalesOrder}`),
        shortItem.qtyOnPurchOrder,
      );
      const shortBy = addDecimal(SHORT_STOCK_ORDERED, `-${available}`);
      lines.push(line(shortItem, SHORT_STOCK_ORDERED, false));
      scenario = {
        kind: "short-stock",
        itemNo: shortItem.no,
        ordered: SHORT_STOCK_ORDERED,
        inStock: shortItem.inventory,
        shortBy,
        suggestedSpr: {
          vendorNo: shortItem.vendorNo,
          itemNo: shortItem.no,
          quantity: shortBy,
        },
      };
    } else {
      // Two or three ordinary lines, never the item that is short on purpose.
      const count = random.int(2, 3);
      const used = new Set<number>([SHORT_STOCK_ITEM_INDEX]);
      while (lines.length < count) {
        const at = random.int(0, items.length - 1);
        const item = items[at];
        if (!item || used.has(at)) continue;
        used.add(at);
        lines.push(line(item, String(random.int(1, 8) * 25), p.shipped));
      }
    }

    const first = lines[0];
    if (!first) throw new Error("An order needs a line");
    const total = lines.reduce(
      (sum, l) => addDecimal(sum, l.lineAmount),
      "0.00",
    );

    if (p.state === "sample-awaiting-payment") {
      scenario = {
        kind: "awaiting-payment",
        prepaymentPercent: p.prepaymentPercent,
        amountDue: multiplyDecimal(total, "0.5"),
      };
    }
    if (p.state === "sample-packing-list-mismatch") {
      scenario = {
        kind: "packing-list-mismatch",
        itemNo: first.no,
        ordered: first.quantity,
        packed: addDecimal(first.quantity, `-${PACKED_SHORT_BY}`),
      };
    }
    if (p.state === "sample-awb-overdue") {
      scenario = {
        kind: "awb-overdue",
        documentType: "AWB",
        dueDate: AWB_DUE_DATE,
        daysOverdue: daysBetween(AWB_DUE_DATE, AS_OF),
      };
    }

    return {
      header: {
        no: `SO-${String(i + 1).padStart(4, "0")}`,
        sellToCustomerNo: customer.no,
        externalDocumentNo: `PO-${customer.countryRegionCode}-${String(4100 + i * 7)}`,
        orderDate: p.orderDate,
        shipmentDate: p.shipmentDate,
        currencyCode: "USD",
        prepaymentPercent: p.prepaymentPercent,
        shipmentMethodCode: i % 2 === 0 ? "FOB" : "CIF",
        shippingAgentCode: p.shipped ? "DEMO-FORWARDER" : null,
        packageTrackingNo: p.tracking,
        navisionStatus: p.navisionStatus,
      },
      lines,
      sampleScreenState: p.state,
      scenario,
    };
  });
}
