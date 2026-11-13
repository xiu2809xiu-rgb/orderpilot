// Writes the three JSON files the design preview reads where the API has no
// answer: how long each step of a flow usually takes, the monthly sales
// history with its forecast, and the stock behind Spark's scripted answer.
//
//   pnpm --filter @orderpilot/synthetic-data build
//   node apps/web/scripts/directions-data.mjs          writes the files
//   node apps/web/scripts/directions-data.mjs --check  says if they are out of date
//
// It runs against the built synthetic data (packages/synthetic-data/dist), at
// the data set's own seed and fixed reference date, so the same code always
// writes the same bytes. Nothing is typed in by hand: change the data or this
// script, run it again, commit the result. directions-data.test.mjs fails when
// the committed files are not what this script writes.

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import {
  RANGE_MULTIPLIER,
  SEASON,
  seasonalNaive,
} from "../src/features/directions/data/forecast.ts";
import {
  median,
  quantile,
  round,
} from "../src/features/directions/data/stats.ts";

export const SCRIPT = "apps/web/scripts/directions-data.mjs";
export const OUT_DIR = path.join(
  import.meta.dirname,
  "../src/features/directions/data",
);
export const DIST = path.join(
  import.meta.dirname,
  "../../../packages/synthetic-data/dist/index.js",
);
export const FILES = ["step-times.json", "history.json", "stock-answer.json"];

/** A step with fewer orders behind it than this is left out: a median of three is a guess. */
export const MIN_ORDERS = 8;

const DAY_MS = 86_400_000;
const HOUR_MS = 3_600_000;

const days = (from, to) =>
  Math.round(
    (Date.parse(`${to}T00:00:00.000Z`) - Date.parse(`${from}T00:00:00.000Z`)) /
      DAY_MS,
  );

// The nine steps of each flow, in the client's own order. Sales keys are the
// tracker's (SalesFlowStepId); the purchase keys are this preview's.
const SALES = [
  "poIn",
  "stock",
  "pi",
  "payment",
  "pack",
  "documents",
  "forwarder",
  "customerTold",
  "awbAndPermit",
];
const PURCHASE = [
  "spr",
  "approval",
  "vendorPo",
  "vendorPi",
  "forwarder",
  "goodsCheck",
  "goodsReceived",
  "customerTold",
  "vendorPaid",
];

const NO_DATE =
  "The data set has no date for this step, so there is nothing to measure.";

function statsOf(values) {
  return {
    n: values.length,
    p25: round(quantile(values, 0.25), 1),
    median: round(median(values), 1),
    p75: round(quantile(values, 0.75), 1),
  };
}

function leftOut(id, position, note) {
  return {
    id,
    position,
    measured: false,
    from: null,
    to: null,
    unit: null,
    n: 0,
    p25: null,
    median: null,
    p75: null,
    note,
  };
}

function stepEntry(id, position, measure) {
  const { from, to, unit, values, note } = measure;
  if (values.length < MIN_ORDERS) {
    return {
      ...leftOut(
        id,
        position,
        `Only ${String(values.length)} orders went through it, fewer than ${String(MIN_ORDERS)}.`,
      ),
      from,
      to,
      n: values.length,
    };
  }
  return {
    id,
    position,
    measured: true,
    from,
    to,
    unit,
    ...statsOf(values),
    note,
  };
}

/** Whole days an order spent at each sales step, from the days its milestones were reached. */
function salesMeasures(orders) {
  const collect = (fn) =>
    orders.flatMap((order) => {
      const span = fn(order.header.orderDate, order.milestones);
      return span === null ? [] : [span];
    });
  const gap = (from, to) => (start, m) => {
    const begin = from === "orderDate" ? start : m[from];
    return begin && m[to] ? days(begin, m[to]) : null;
  };
  return {
    poIn: {
      from: "PO received",
      to: "fields confirmed",
      unit: "days",
      values: collect(gap("orderDate", "fields")),
      note: "From the order date to the day the PO's fields were confirmed.",
    },
    stock: {
      from: "fields confirmed",
      to: "stock checked, and the SPR approved when one was raised",
      unit: "days",
      values: collect((start, m) => {
        const end = m.approved ?? m.stock;
        return m.fields && end ? days(m.fields, end) : null;
      }),
      note: "Includes the SPR approval for the orders that needed one.",
    },
    pi: {
      from: "stock checked, or the SPR approved",
      to: "PI sent",
      unit: "days",
      values: collect((start, m) => {
        const begin = m.approved ?? m.stock;
        return begin && m.pi ? days(begin, m.pi) : null;
      }),
      note: "From the end of the stock step to the day the PI went out.",
    },
    payment: {
      from: "PI sent",
      to: "payment received",
      unit: "days",
      values: collect(gap("pi", "paid")),
      note: "Customers pay before goods ship, so this is the longest wait.",
    },
    pack: {
      from: "payment received",
      to: "goods packed",
      unit: "days",
      values: collect(gap("paid", "packed")),
      note: "From Finance's confirmation to the warehouse finishing the pack.",
    },
    forwarder: {
      from: "goods packed",
      to: "goods shipped",
      unit: "days",
      values: collect(gap("packed", "shipped")),
      note: "From packed to the day the forwarder took the goods.",
    },
  };
}

const salesNotes = {
  documents:
    "The data set posts the invoice after the goods ship, so no date marks the invoice and packing list being made before release.",
  customerTold:
    "The data set holds no date for the customer being told the shipping details.",
  awbAndPermit:
    "The data set holds no date for the AWB or BL and the import permit being followed up.",
};

function salesSteps(orders) {
  const measures = salesMeasures(orders);
  return SALES.map((id, i) => {
    const measure = measures[id];
    return measure
      ? stepEntry(id, i + 1, measure)
      : leftOut(id, i + 1, salesNotes[id] ?? NO_DATE);
  });
}

const hoursBetween = (from, to) =>
  Math.round(((Date.parse(to) - Date.parse(from)) / HOUR_MS) * 10) / 10;

const purchaseNotes = {
  spr: "The request is the start of the clock for the approval step, so it has no time of its own.",
  vendorPo:
    "The data set makes the vendor PO on the day the SPR is approved, so it never varies.",
  goodsReceived:
    "Measured together with the steps before it, as the span from vendor PO to goods received.",
};

function purchaseSteps(sprs) {
  const hours = sprs.flatMap((spr) =>
    spr.decision ? [hoursBetween(spr.requestedAt, spr.decision.at)] : [],
  );
  return PURCHASE.map((id, i) =>
    id === "approval"
      ? stepEntry(id, i + 1, {
          from: "SPR raised",
          to: "SPR approved",
          unit: "hours",
          values: hours,
          note: "From the request's time to the approver's decision.",
        })
      : leftOut(id, i + 1, purchaseNotes[id] ?? NO_DATE),
  );
}

function purchaseSpans(history, vendors) {
  const taken = (receipts) =>
    receipts.map((r) => days(r.orderedOn, r.receivedOn));
  const names = new Map(vendors.map((v) => [v.no, v.name]));
  const byVendor = [...Map.groupBy(history.receipts, (r) => r.vendorNo)]
    .map(([vendorNo, receipts]) => ({
      vendorNo,
      vendorName: names.get(vendorNo) ?? vendorNo,
      ...statsOf(taken(receipts)),
    }))
    .filter((vendor) => vendor.n >= MIN_ORDERS)
    .sort((a, b) => a.vendorNo.localeCompare(b.vendorNo));
  return [
    {
      id: "poToReceipt",
      fromStep: "vendorPo",
      toStep: "goodsReceived",
      unit: "days",
      ...statsOf(taken(history.receipts)),
      note: "Days from the vendor PO to the goods being received, over the 24 months of receipts in the history.",
      byVendor,
    },
  ];
}

function sourceOf(dataset) {
  return {
    script: SCRIPT,
    dataSet: "@orderpilot/synthetic-data",
    label: dataset.label,
    seed: dataset.seed,
    referenceDate: dataset.asOf,
  };
}

function stepTimes(dataset, history) {
  return {
    source: sourceOf(dataset),
    method:
      "For each step, the days (or hours) between the two milestones of the orders that went through it. Percentiles are linear (25th, 50th, 75th). A step with fewer than 8 orders, or with no date in the data, is left out.",
    orders: dataset.orders.length,
    sales: salesSteps(dataset.orders),
    purchase: purchaseSteps(dataset.sprs),
    purchaseSpans: purchaseSpans(history, dataset.vendors),
  };
}

function historyFile(data, dataset, history) {
  // Grouping by category covers every line once, so its sum is the total.
  const byCategory = [...data.monthlySales(history, "category").values()];
  const amountUsd = history.months.map((_, at) =>
    round(
      byCategory.reduce((acc, line) => acc + Number(line.amount[at]), 0),
      2,
    ),
  );
  const units = history.months.map((_, at) =>
    byCategory.reduce((acc, line) => acc + (line.units[at] ?? 0), 0),
  );
  const categoryOf = new Map(dataset.brands.map((b) => [b.name, b.category]));
  const brands = [...data.monthlySales(history, "brand")]
    .map(([brand, line]) => ({
      brand,
      category: categoryOf.get(brand) ?? "",
      amountUsd: line.amount.map(Number),
      units: line.units,
    }))
    .sort((a, b) => a.brand.localeCompare(b.brand));
  const last = history.months[history.months.length - 1];
  const forecast = seasonalNaive(amountUsd, last, 6);
  return {
    source: sourceOf(dataset),
    months: history.months,
    total: { amountUsd, units },
    brands,
    forecast: {
      method: `Seasonal naive on ${String(history.months.length)} months of history: each month ahead repeats the same month a year earlier. The range is plus or minus ${String(RANGE_MULTIPLIER)} times the error the same method made on the last ${String(forecast.errorMonths)} months, about an 80 percent range.`,
      name: "seasonal-naive",
      season: SEASON,
      rangeMultiplier: RANGE_MULTIPLIER,
      errorMonths: forecast.errorMonths,
      errorUsd: forecast.error,
      amountUsd: forecast.points,
    },
  };
}

function stockFile(data, dataset) {
  const brand = "HP";
  const monitors = dataset.items.filter((item) =>
    /monitor/i.test(item.description),
  );
  const available = (item) => Number(data.availableStock(item));
  const items = monitors
    .filter((item) => item.brand === brand)
    .map((item) => ({
      itemNo: item.no,
      description: item.description,
      partNumber: item.partNumber,
      vendorNo: item.vendorNo,
      onHand: Number(item.inventory),
      onSalesOrders: Number(item.qtyOnSalesOrder),
      onPurchaseOrders: Number(item.qtyOnPurchOrder),
      available: available(item),
    }));
  const sum = (key) => items.reduce((acc, item) => acc + item[key], 0);
  const others = new Map();
  for (const item of monitors.filter((m) => m.brand !== brand)) {
    const row = others.get(item.brand) ?? {
      brand: item.brand,
      items: 0,
      available: 0,
    };
    row.items += 1;
    row.available += available(item);
    others.set(item.brand, row);
  }
  return {
    source: sourceOf(dataset),
    question: "How many HP monitors do we have?",
    brand,
    note: `The catalogue holds ${String(items.length)} HP monitor${items.length === 1 ? "" : "s"}. Available is on hand, minus on sales orders, plus on purchase orders.`,
    items,
    totals: {
      onHand: sum("onHand"),
      onSalesOrders: sum("onSalesOrders"),
      onPurchaseOrders: sum("onPurchaseOrders"),
      available: sum("available"),
    },
    otherBrands: [...others.values()].sort((a, b) =>
      a.brand.localeCompare(b.brand),
    ),
  };
}

/**
 * The three files as text, from a loaded synthetic-data module. The test
 * passes the module from source; the command line passes the built one.
 */
export async function buildDirectionsData(data) {
  const dataset = data.createSyntheticDataset({
    seed: data.DEFAULT_SEED,
    referenceDate: data.AS_OF,
  });
  const history = data.salesHistory(dataset);
  const files = {
    "step-times.json": stepTimes(dataset, history),
    "history.json": historyFile(data, dataset, history),
    "stock-answer.json": stockFile(data, dataset),
  };
  // The repository checks every JSON file with Prettier, so the files are
  // written the way Prettier writes them.
  const { format, resolveConfig } = await import("prettier");
  const out = {};
  for (const [name, value] of Object.entries(files)) {
    const file = path.join(OUT_DIR, name);
    const options = (await resolveConfig(file)) ?? {};
    out[name] = await format(JSON.stringify(value), {
      ...options,
      filepath: file,
    });
  }
  return out;
}

async function main() {
  if (!existsSync(DIST)) {
    console.error(
      "The synthetic data is not built. Run: pnpm --filter @orderpilot/synthetic-data build",
    );
    process.exit(1);
  }
  const data = await import(pathToFileURL(DIST).href);
  const files = await buildDirectionsData(data);
  const check = process.argv.includes("--check");
  const stale = [];
  for (const [name, text] of Object.entries(files)) {
    const file = path.join(OUT_DIR, name);
    const held = existsSync(file) ? readFileSync(file, "utf8") : null;
    if (held === text) continue;
    if (check) {
      stale.push(name);
    } else {
      writeFileSync(file, text);
      console.log(`wrote ${name}`);
    }
  }
  if (stale.length > 0) {
    console.error(
      `Out of date: ${stale.join(", ")}. Run the script and commit the result.`,
    );
    process.exit(1);
  }
}

if (import.meta.main) await main();
