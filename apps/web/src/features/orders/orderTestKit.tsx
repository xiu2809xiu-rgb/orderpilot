// Test-only: the order pages in a router, with the API faked at the network.
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { createMemoryRouter, RouterProvider } from "react-router";
import type { Permission, Role, SalesOrderDetail } from "@orderpilot/shared";
import { Toaster } from "@/components/common";
import { useSessionStore } from "@/stores/session";
import { errorBody, sessionFor } from "@/test/fixtures";
import { server } from "@/test/server";
import DraftOrderPage from "./DraftOrderPage";
import NewOrderPage from "./NewOrderPage";

const LIST_PAGE = "Orders list";

export const NEW_ORDER_NO = "SO-20261109-0001";

/** A stored draft, in the shape the API answers with. */
export function draftDetail(
  over: Partial<SalesOrderDetail> = {},
): SalesOrderDetail {
  const shown = {
    field: "item.unitPrice",
    classification: "confidential" as const,
    masked: false,
    reason: null,
  };
  return {
    orderNo: NEW_ORDER_NO,
    source: "stored",
    captureState: "draft",
    customerNo: "C-0001",
    customerName: "Quillon Harbour Traders",
    externalDocumentNo: "PO-7731",
    orderDate: "2026-11-09",
    shipmentDate: null,
    workflowStatus: null,
    amount: { ...shown, value: "36.80" },
    currencyCode: "USD",
    shortage: null,
    shortageCount: 0,
    prepaymentPercent: "100.00",
    navisionNo: null,
    version: 3,
    lines: [
      {
        lineNo: 1,
        itemNo: "I-0001",
        description: "Norvale Wireless Mouse",
        quantity: "2.000",
        qtyToShip: "2.000",
        unitPrice: { ...shown, value: "18.40" },
        lineAmount: { ...shown, value: "36.80" },
        shortBy: null,
      },
    ],
    ...over,
  };
}

export const maskedPrice = {
  field: "item.unitPrice",
  classification: "restricted" as const,
  masked: true,
  value: null,
  reason: "price" as const,
};

const ITEM = {
  no: "I-0001",
  description: "Norvale Wireless Mouse",
  partNumber: "NV-WM-100",
  brand: "Norvale",
  category: "peripherals",
  baseUnitOfMeasure: "PCS",
  inventory: "40.000",
  qtyOnSalesOrder: "0.000",
  qtyOnPurchOrder: "0.000",
  availableStock: "40.000",
  availability: "in_stock",
  vendorNo: "V-0001",
  vendorName: "Norvale Supply",
};

export interface Requests {
  posts: unknown[];
  patches: unknown[];
  voids: unknown[];
  itemReads: number;
  stockReads: number;
  lastPriceReads: number;
}

export interface FakeApi {
  /** What the order read answers. */
  detail: () => SalesOrderDetail;
  /** What the available-stock read answers. */
  stock: () => string;
  /** The last agreed price the customer paid for I-0001, or null for never. */
  lastPrice: () => string | null;
  masked: boolean;
}

/**
 * Handlers for what the order pages call. A test changes `api` between calls to
 * move what the server says, and reads what was sent from `requests`.
 */
export function fakeServer(over: Partial<FakeApi> = {}) {
  const api: FakeApi = {
    detail: () => draftDetail(),
    stock: () => "40.000",
    lastPrice: () => "17.90",
    masked: false,
    ...over,
  };
  const requests: Requests = {
    posts: [],
    patches: [],
    voids: [],
    itemReads: 0,
    stockReads: 0,
    lastPriceReads: 0,
  };
  server.use(
    http.get("*/api/v1/master-data/items", () => {
      requests.itemReads += 1;
      return HttpResponse.json({
        data: [
          {
            ...ITEM,
            unitPrice: api.masked
              ? maskedPrice
              : { ...maskedPrice, masked: false, value: "18.40", reason: null },
          },
        ],
        meta: { page: 1, pageSize: 10, total: 1, mock: true },
      });
    }),
    http.get("*/api/v1/master-data/customers", () =>
      HttpResponse.json({
        data: [
          {
            no: "C-0001",
            name: "Quillon Harbour Traders",
            countryRegionCode: "IN",
            currencyCode: "USD",
            paymentTermsCode: "PREPAID",
            openOrders: 0,
            overdueOrders: 0,
          },
        ],
        meta: { page: 1, pageSize: 10, total: 1, mock: true },
      }),
    ),
    http.get("*/api/v1/master-data/available-stock", () => {
      requests.stockReads += 1;
      return HttpResponse.json({
        data: [{ itemNo: "I-0001", availableStock: api.stock(), unit: "PCS" }],
        meta: { mock: true },
      });
    }),
    http.get("*/api/v1/master-data/customers/:no/last-prices", () => {
      requests.lastPriceReads += 1;
      const price = api.lastPrice();
      return HttpResponse.json({
        data:
          price === null
            ? []
            : [
                {
                  itemNo: "I-0001",
                  price: {
                    ...maskedPrice,
                    masked: false,
                    value: price,
                    reason: null,
                  },
                  agreedOn: "2026-10-14",
                  documentNo: "SO-0007",
                },
              ],
        meta: { mock: true },
      });
    }),
    http.get("*/api/v1/orders/:orderNo", () =>
      HttpResponse.json({ data: api.detail() }),
    ),
  );
  return { api, requests };
}

export { errorBody, http, HttpResponse };

/** The server of this test run, for a handler that only one test needs. */
export { server };

type Reply = () => Response;

/** Answers a write, and keeps what was sent. The body is read before the answer. */
export function answerWrite(
  method: "post" | "patch",
  path: string,
  sink: unknown[],
  reply: Reply,
) {
  server.use(
    http[method](path, async ({ request }) => {
      sink.push(await request.json());
      return reply();
    }),
  );
}

/** A 201 or 200 with the order the server now holds. */
export const saved =
  (detail: SalesOrderDetail, status = 201): Reply =>
  () =>
    HttpResponse.json({ data: detail }, { status });

/** An error in the one envelope. */
export const refused =
  (
    status: number,
    code: string,
    details: { path: string; message: string }[] | null,
    message = "The server said no.",
    traceId = "trace-test-9",
  ): Reply =>
  () =>
    HttpResponse.json(
      { error: { code, message, details, traceId } },
      { status },
    );

/** Renders the pages at `path`, signed in as `role`, with extra permissions if given. */
export function renderOrders(
  path: string,
  role: Role = "SUPPORT",
  extra: readonly Permission[] = [],
) {
  const session = sessionFor(role);
  useSessionStore.setState({
    status: "active",
    session: { ...session, permissions: [...session.permissions, ...extra] },
  });
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const router = createMemoryRouter(
    [
      { path: "/orders", element: <p>{LIST_PAGE}</p> },
      { path: "/orders/new", element: <NewOrderPage /> },
      { path: "/orders/:orderNo", element: <DraftOrderPage /> },
    ],
    { initialEntries: [path] },
  );
  const view = render(
    <QueryClientProvider client={client}>
      <Toaster />
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return { router, client, ...view };
}
