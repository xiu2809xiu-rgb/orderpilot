import type { Role, WorkflowTask } from "@orderpilot/shared";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { MemoryRouter, Route, Routes } from "react-router";
import { Toaster } from "@/components/common/Toaster";
import i18n from "@/i18n";
import { useSessionStore } from "@/stores/session";
import { errorBody, sessionFor } from "@/test/fixtures";
import { server } from "@/test/server";
import HomeScreen from "./HomeScreen";

// What the home screen reads, as the real API would send it: the same shapes,
// a few rows, served by MSW. Test use only. Nothing here is typed into the
// screen itself.

export const NAMESPACES = [
  "directions",
  "directions-home",
  "directions-parts",
  "home",
  "components",
  "common",
];

export async function loadHomeNamespaces(): Promise<void> {
  await i18n.loadNamespaces(NAMESPACES);
}

const NOW = Date.now();
const iso = (hoursFromNow: number) =>
  new Date(NOW + hoursFromNow * 3_600_000).toISOString();

let counter = 0;

/** A task as the API sends it. Pass only what a case is about. */
export function makeTask(overrides: Partial<WorkflowTask> = {}): WorkflowTask {
  counter += 1;
  const id = `00000000-0000-4000-8000-${String(counter).padStart(12, "0")}`;
  return {
    id,
    kind: "PACK_ORDER",
    title: "Pack the order",
    assigneeRole: "WAREHOUSE",
    orderNo: `SO-${String(7 + counter).padStart(4, "0")}`,
    ref: null,
    status: "OPEN",
    createdAt: iso(-48),
    dueAt: iso(-5),
    overdue: true,
    customerNo: "C-0012",
    customerName: "Synthetic Harbour Traders",
    amount: "12340.00",
    currencyCode: "USD",
    ...overrides,
  };
}

export function page<T>(items: readonly T[], total = items.length) {
  return {
    data: items,
    meta: { page: 1, pageSize: 25, total, mock: true },
  };
}

const STEP_IDS = [
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

export const FLOW = {
  openOrders: 106,
  steps: STEP_IDS.map((id, index) => ({
    id,
    statuses: [`sample-${id}`],
    count: index === 1 ? 22 : 6 + index,
  })),
};

export const KPIS = {
  note: "Mock lab estimates on synthetic data.",
  measures: [
    "Order-processing time",
    "Manual touches per order",
    "Data-entry errors",
    "Approval turnaround",
    "Overdue orders",
  ].map((label, index) => ({
    id: `m${String(index)}`,
    label,
    unit: "hours",
    manual: 20,
    withOrderPilot: 12,
    lowerIsBetter: true,
    target: 10,
    trend: [],
  })),
};

export const OVERDUE_ORDER = {
  orderNo: "SO-0045",
  externalDocumentNo: "EXT-1",
  customerNo: "C-0001",
  customerName: "Kandaleya Electronics (Pvt) Ltd",
  status: { code: "sample-short", label: "Packing list differs from the PO" },
  ownerRole: "SUPPORT",
  overdue: { overdue: true, daysOverdue: 3, reason: "Late" },
  openExceptions: 1,
  shipmentDate: null,
  orderDate: "2026-10-01",
  amount: "31406.97",
  currencyCode: "USD",
};

export const REFUSED_EVENT = {
  sequence: 557,
  id: "00000000-0000-4000-8000-0000000000a1",
  occurredAt: iso(-1),
  actorKind: "user",
  actorUserId: null,
  actorRole: "WAREHOUSE",
  actorName: "Hafiz Rahman",
  action: "auth.refused",
  entityType: "auth",
  entityId: "x",
  summary: "Hafiz Rahman was refused viewing the audit trail",
  changes: [],
  ip: null,
  traceId: "t",
  prevHash: null,
  hash: "h",
  refusal: true,
};

export const RULES = [
  {
    id: "approvers",
    value:
      "Any one of three management approvers decides, after a coordinator routes it",
    status: "confirmed",
    screen: null,
  },
  {
    id: "approvalLimits",
    value: "None set. Limits stay a setting, off until Spectra asks for them",
    status: "open",
    screen: null,
  },
];

export interface HomeApi {
  tasks?: readonly WorkflowTask[];
  /** What the tasks list answers with instead of the rows. */
  tasksStatus?: number;
  overdue?: readonly unknown[];
  overdueTotal?: number;
  refused?: readonly unknown[];
  rules?: readonly unknown[];
  /** The status each of the three block lists answers with. */
  blockStatus?: number;
  /** A list the tiles count answers with this status. */
  trackerStatus?: number;
  /**
   * Whether the orders list shows its amounts: the server's answer to "may
   * this role see prices". False answers them masked, as it does for
   * Warehouse and Logistics.
   */
  prices?: boolean;
}

/** What the screen sent, and which tasks the server now counts as done. */
export interface Served {
  calls: string[];
  done: string[];
  approved: string[];
  paid: string[];
}

/** Serves the home screen's API. The last handler answers every other list with seven rows. */
export function serveHome(api: HomeApi = {}): Served {
  const served: Served = { calls: [], done: [], approved: [], paid: [] };
  const open = () =>
    (api.tasks ?? []).filter(
      (task) =>
        !served.done.includes(task.id) &&
        !served.approved.includes(task.id) &&
        !served.paid.includes(task.orderNo ?? ""),
    );
  const fail = (status: number) =>
    HttpResponse.json(errorBody("INTERNAL_ERROR", "trace-home-1"), { status });
  const block = (rows: readonly unknown[] | undefined, total?: number) =>
    api.blockStatus
      ? fail(api.blockStatus)
      : HttpResponse.json(page(rows ?? [], total));
  server.use(
    http.get("*/api/v1/workflows/tasks", ({ request }) => {
      served.calls.push(`GET ${new URL(request.url).pathname}`);
      if (api.tasksStatus) return fail(api.tasksStatus);
      const url = new URL(request.url);
      const rows =
        url.searchParams.get("overdue") === "true"
          ? open().filter((task) => task.overdue)
          : open();
      return HttpResponse.json(page(rows));
    }),
    http.post("*/api/v1/workflows/tasks/:id/complete", ({ params }) => {
      served.calls.push(`POST complete ${String(params.id)}`);
      served.done.push(String(params.id));
      return HttpResponse.json({
        data: { taskId: String(params.id), status: "DONE" },
        meta: { mock: true },
      });
    }),
    http.post("*/api/v1/workflows/tasks/:id/undo", ({ params }) => {
      served.calls.push(`POST undo ${String(params.id)}`);
      served.done = served.done.filter((id) => id !== String(params.id));
      return HttpResponse.json({
        data: { taskId: String(params.id), status: "OPEN" },
        meta: { mock: true },
      });
    }),
    http.post("*/api/v1/workflows/sprs/:recordNo/approve", ({ params }) => {
      served.calls.push(`POST approve ${String(params.recordNo)}`);
      const row = (api.tasks ?? []).find(
        (task) => task.ref?.recordNo === params.recordNo,
      );
      if (row) served.approved.push(row.id);
      return HttpResponse.json({ data: {}, meta: { mock: true } });
    }),
    http.post("*/api/v1/workflows/sprs/:recordNo/undo", ({ params }) => {
      served.calls.push(`POST undo-decision ${String(params.recordNo)}`);
      served.approved = [];
      return HttpResponse.json({ data: {}, meta: { mock: true } });
    }),
    http.post("*/api/v1/workflows/orders/:orderNo/payments", ({ params }) => {
      served.calls.push(`POST payment ${String(params.orderNo)}`);
      served.paid.push(String(params.orderNo));
      return HttpResponse.json({
        data: { paymentId: "00000000-0000-4000-8000-0000000000b1" },
        meta: { mock: true },
      });
    }),
    http.post(
      "*/api/v1/workflows/orders/:orderNo/payments/:paymentId/undo",
      ({ params }) => {
        served.calls.push(`POST undo-payment ${String(params.orderNo)}`);
        served.paid = [];
        return HttpResponse.json({ data: {}, meta: { mock: true } });
      },
    ),
    http.get("*/api/v1/orders", () => {
      served.calls.push("GET /api/v1/orders");
      const seen = api.prices === true;
      return HttpResponse.json({
        data: [
          {
            orderNo: "SO-0001",
            customerNo: "C-0001",
            customerName: "Synthetic Harbour Traders",
            amount: {
              field: "item.unitPrice",
              classification: "confidential",
              masked: !seen,
              value: seen ? "100.00" : null,
              reason: seen ? null : "price",
            },
            currencyCode: "USD",
          },
        ],
        meta: { page: 1, pageSize: 1, total: 1, mock: true },
      });
    }),
    http.get("*/api/v1/tracker/flow", () => {
      served.calls.push("GET /api/v1/tracker/flow");
      return HttpResponse.json({ data: FLOW, meta: { mock: true } });
    }),
    http.get("*/api/v1/tracker/orders", ({ request }) => {
      const url = new URL(request.url);
      served.calls.push(`GET ${url.pathname}${url.search}`);
      if (api.trackerStatus) return fail(api.trackerStatus);
      return url.searchParams.get("overdue") === "true"
        ? block(api.overdue, api.overdueTotal)
        : HttpResponse.json(page([], 4));
    }),
    http.get("*/api/v1/audit/events", ({ request }) => {
      const url = new URL(request.url);
      served.calls.push(`GET ${url.pathname}${url.search}`);
      return url.searchParams.get("pageSize") === "1"
        ? HttpResponse.json(page([], 9))
        : block(api.refused);
    }),
    http.get("*/api/v1/workflows/open-rules", () => {
      served.calls.push("GET /api/v1/workflows/open-rules");
      return api.blockStatus
        ? fail(api.blockStatus)
        : HttpResponse.json({ data: api.rules ?? [], meta: { mock: true } });
    }),
    http.get("*/api/v1/insights/kpis", () => {
      served.calls.push("GET /api/v1/insights/kpis");
      return HttpResponse.json({ data: KPIS, meta: { mock: true } });
    }),
    http.get("*/api/v1/system/checks/status", () => {
      served.calls.push("GET /api/v1/system/checks/status");
      return HttpResponse.json({
        data: [
          { name: "database", status: "up", durationMs: 3 },
          { name: "redis", status: "up", durationMs: 4 },
        ],
      });
    }),
    http.get("*/api/v1/*", () => HttpResponse.json(page([], 7))),
  );
  return served;
}

/** Renders the home screen as one role, with the toaster the shell would draw. */
export function renderHome(role: Role) {
  useSessionStore.setState({ status: "active", session: sessionFor(role) });
  document.cookie = "op_csrf=csrf-token-1";
  // No retries: a failed request must show its error at once, not after a back-off.
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={["/"]}>
        <Routes>
          <Route path="/" element={<HomeScreen />} />
          <Route path="*" element={null} />
        </Routes>
        <Toaster />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}
