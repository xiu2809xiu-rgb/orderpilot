import { QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import type { ReactElement } from "react";
import { MemoryRouter, Route, Routes } from "react-router";
import { vi } from "vitest";
import i18n from "@/i18n";
import { createQueryClient } from "@/lib/query";

// What the preview's two screens read, as the real API would send it: the same
// shapes, a few rows. Nothing here is typed into a screen itself.

export const NAMESPACES = [
  "directions",
  "directions-orders",
  "directions-parts",
  "order-tracker",
  "home",
  "components",
  "common",
];

export async function loadNamespaces(): Promise<void> {
  await i18n.loadNamespaces(NAMESPACES);
}

const NOW = Date.now();
const day = (daysFromNow: number) =>
  new Date(NOW + daysFromNow * 86_400_000).toISOString();
const dateOnly = (daysFromNow: number) => day(daysFromNow).slice(0, 10);

const OPEN_MASK = {
  field: "item.unitPrice",
  classification: "confidential",
  masked: false,
  reason: null,
};

export function amount(value: string, masked = false) {
  return masked
    ? { ...OPEN_MASK, masked: true, value: null, reason: "price" }
    : { ...OPEN_MASK, value };
}

interface OrderSpec {
  orderNo: string;
  customerNo: string;
  customerName: string;
  status: { code: string; label: string };
  ownerRole: string;
  daysOverdue?: number;
  openExceptions?: number;
  shortBy?: string;
  value: string;
  orderedDaysAgo: number;
  shipInDays: number | null;
}

export const SPECS: OrderSpec[] = [
  {
    orderNo: "SO-0001",
    customerNo: "C-0001",
    customerName: "Alpha Traders",
    status: { code: "sample-awaiting-payment", label: "Waiting for payment" },
    ownerRole: "FINANCE",
    daysOverdue: 3,
    value: "7960.80",
    orderedDaysAgo: 14,
    shipInDays: 7,
  },
  {
    orderNo: "SO-0002",
    customerNo: "C-0002",
    customerName: "Beta Stores",
    status: { code: "sample-pi-to-send", label: "Proforma invoice to send" },
    ownerRole: "SUPPORT",
    value: "15676.34",
    orderedDaysAgo: 6,
    shipInDays: 17,
  },
  {
    orderNo: "SO-0003",
    customerNo: "C-0003",
    customerName: "Gamma Electronics",
    status: {
      code: "sample-packing-list-mismatch",
      label: "Packing list differs from the PO",
    },
    ownerRole: "WAREHOUSE",
    openExceptions: 1,
    value: "31406.97",
    orderedDaysAgo: 15,
    shipInDays: -2,
  },
  {
    orderNo: "SO-0004",
    customerNo: "C-0001",
    customerName: "Alpha Traders",
    status: { code: "sample-closed", label: "Closed" },
    ownerRole: "FINANCE",
    shortBy: "20.00",
    value: "4100.00",
    orderedDaysAgo: 40,
    shipInDays: -20,
  },
];

export const FLOW = {
  openOrders: 3,
  steps: [
    ["poIn", ["sample-po-received", "sample-extracted-awaiting-review"]],
    ["stock", ["sample-short-stock", "sample-pending-approval"]],
    ["pi", ["sample-pi-to-send"]],
    ["payment", ["sample-awaiting-payment"]],
    ["pack", ["sample-ready-to-pick"]],
    ["documents", ["sample-packing-list-mismatch"]],
    ["forwarder", ["sample-shipped"]],
    ["customerTold", ["sample-invoiced"]],
    ["awbAndPermit", ["sample-awb-overdue"]],
  ].map(([id, statuses]) => ({ id, statuses, count: 1 })),
};

function ordersRow(spec: OrderSpec, masked: boolean) {
  return {
    orderNo: spec.orderNo,
    source: "sample",
    captureState: null,
    customerNo: spec.customerNo,
    customerName: spec.customerName,
    externalDocumentNo: `PO-${spec.orderNo}`,
    orderDate: dateOnly(-spec.orderedDaysAgo),
    shipmentDate: spec.shipInDays === null ? null : dateOnly(spec.shipInDays),
    workflowStatus: spec.status.label,
    amount: amount(spec.value, masked),
    currencyCode: "USD",
    shortage: spec.shortBy
      ? {
          itemNo: "I-0190",
          ordered: "100.00",
          availableStock: "80.00",
          shortBy: spec.shortBy,
        }
      : null,
    shortageCount: spec.shortBy ? 1 : 0,
  };
}

function trackerRow(spec: OrderSpec) {
  return {
    orderNo: spec.orderNo,
    externalDocumentNo: `PO-${spec.orderNo}`,
    customerNo: spec.customerNo,
    customerName: spec.customerName,
    status: spec.status,
    ownerRole: spec.ownerRole,
    overdue: {
      overdue: (spec.daysOverdue ?? 0) > 0,
      daysOverdue: spec.daysOverdue ?? 0,
      reason: spec.daysOverdue ? `${spec.status.label} was due` : null,
    },
    openExceptions: spec.openExceptions ?? 0,
    shipmentDate: spec.shipInDays === null ? null : dateOnly(spec.shipInDays),
    orderDate: dateOnly(-spec.orderedDaysAgo),
    // The tracker's own amount is not masked: the screens must never show it.
    amount: spec.value,
    currencyCode: "USD",
  };
}

/** The order's own events: it is paid and waits to be packed. */
export function timelineOf(spec: OrderSpec) {
  const at = (hours: number) => day(-spec.orderedDaysAgo + hours / 24);
  const steps = [
    ["Customer PO received", "System", 0],
    ["Fields read from the PO", "System", 1],
    ["Stock checked against the order", "Support", 2],
    ["Proforma invoice sent", "Support", 3],
    ["Payment received", "Finance", 4],
  ].map(([title, actor, hours], index, all) => ({
    id: `${spec.orderNo}-step-${String(index + 1)}`,
    at: at(Number(hours)),
    actor: String(actor),
    title: String(title),
    effect: `Effect of ${String(title)}`,
    current: index === all.length - 1,
  }));
  const check = (id: string, outcome: "pass" | "fail", types: string[]) => ({
    id,
    ruleId: `mock.${id}`,
    ruleLabel: `Rule ${id}`,
    orderNo: spec.orderNo,
    outcome,
    expected: "83",
    actual: outcome === "pass" ? "83" : "75",
    tolerance: { label: "Exact", value: "0" },
    evidence: types.map((documentType) => ({
      documentId: `${spec.orderNo}-${documentType.toLowerCase()}`,
      documentType,
      location: "line 1",
      value: "83",
    })),
    checkedAt: at(5),
  });
  return {
    orderNo: spec.orderNo,
    externalDocumentNo: `PO-${spec.orderNo}`,
    customerNo: spec.customerNo,
    customerName: spec.customerName,
    status: spec.status,
    ownerRole: spec.ownerRole,
    overdue: trackerRow(spec).overdue,
    steps,
    checks: [
      check("customer", "pass", ["CUSTOMER_PO"]),
      check("quantity", "fail", ["CUSTOMER_PO", "PACKING_LIST"]),
    ],
    matches: [
      {
        kind: "customer",
        printedNo: spec.customerNo,
        printedName: spec.customerName.toUpperCase(),
        matchedNo: spec.customerNo,
        matchedName: spec.customerName,
        possibleMatches: [{ no: "C-0009", name: "Look-alike Ltd" }],
      },
    ],
  };
}

function detailOf(spec: OrderSpec, masked: boolean) {
  const line = (n: number, price: string, quantity: string) => ({
    lineNo: n,
    itemNo: `I-000${String(n)}`,
    description: `Item ${String(n)}`,
    quantity,
    qtyToShip: quantity,
    unitPrice: amount(price, masked),
    lineAmount: amount(String(Number(price) * Number(quantity)), masked),
    shortBy: n === 2 ? "5" : null,
  });
  return {
    ...ordersRow(spec, masked),
    prepaymentPercent: "30",
    navisionNo: spec.orderNo,
    version: null,
    lines: [line(1, "169.19", "83"), line(2, "553.93", "20")],
  };
}

export interface ApiOptions {
  masked?: boolean;
  ordersFail?: boolean;
  tasks?: unknown[];
  specs?: OrderSpec[];
  /** Orders with a document to confirm. */
  toConfirm?: string[];
}

function reply(body: unknown, status = 200) {
  return Promise.resolve(
    new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    }),
  );
}

const notFound = () =>
  reply(
    {
      error: { code: "NOT_FOUND", message: "x", details: null, traceId: "t1" },
    },
    404,
  );

/** Stubs fetch with the API's answers. Returns the paths asked, in order. */
export function stubApi(options: ApiOptions = {}): string[] {
  const specs = options.specs ?? SPECS;
  const masked = options.masked ?? false;
  const calls: string[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.href
            : input.url,
        "http://localhost",
      );
      calls.push(`${init?.method ?? "GET"} ${url.pathname}${url.search}`);
      const path = url.pathname;
      const page = (rows: unknown[]) =>
        reply({
          data: rows,
          meta: { page: 1, pageSize: 200, total: rows.length, mock: true },
        });
      if (path.endsWith("/orders") && !path.includes("/tracker")) {
        if (options.ordersFail) {
          return reply(
            {
              error: {
                code: "VALIDATION_FAILED",
                message: "x",
                details: null,
                traceId: "trace-123",
              },
            },
            400,
          );
        }
        return page(specs.map((spec) => ordersRow(spec, masked)));
      }
      if (path.endsWith("/tracker/orders")) {
        const wanted = url.searchParams.get("documentToConfirm") === "true";
        const search = url.searchParams.get("search");
        const rows = specs
          .filter((spec) =>
            wanted ? (options.toConfirm ?? []).includes(spec.orderNo) : true,
          )
          .filter((spec) => (search ? spec.orderNo === search : true));
        return page(rows.map(trackerRow));
      }
      if (path.endsWith("/tracker/flow")) {
        return reply({ data: FLOW, meta: { mock: true } });
      }
      const timeline = /\/tracker\/orders\/(SO-\d+)$/.exec(path);
      if (timeline) {
        const spec = specs.find((s) => s.orderNo === timeline[1]);
        return spec
          ? reply({ data: timelineOf(spec), meta: { mock: true } })
          : notFound();
      }
      const one = /\/orders\/(SO-\d+)$/.exec(path);
      if (one) {
        const spec = specs.find((s) => s.orderNo === one[1]);
        return spec ? reply({ data: detailOf(spec, masked) }) : notFound();
      }
      if (path.endsWith("/workflows/tasks")) {
        return page(options.tasks ?? []);
      }
      return notFound();
    }),
  );
  return calls;
}

/** The task of a person on an order, as the tasks endpoint sends it. */
export function taskOn(orderNo: string, kind: string) {
  return {
    id: "00000000-0000-4000-8000-000000000001",
    kind,
    title: kind,
    assigneeRole: "SUPPORT",
    orderNo,
    ref: null,
    status: "OPEN",
    createdAt: day(-3),
    dueAt: day(-1),
    overdue: true,
    customerName: "Beta Stores",
  };
}

export function renderAt(element: ReactElement, path: string) {
  return render(
    <QueryClientProvider client={createQueryClient()}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/directions/:direction/:screen" element={element} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

/** The nth item of a list, or a failure that says so: the tests read lists by place. */
export function nth<T>(items: readonly T[], at: number): T {
  const item = items[at];
  if (item === undefined) throw new Error(`No item at ${String(at)}`);
  return item;
}
