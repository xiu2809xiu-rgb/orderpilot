import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { MemoryRouter } from "react-router";
import { describe, expect, it } from "vitest";
import i18n from "@/i18n";
import { getMasterDataCustomersMockHandler } from "@/lib/api/generated/endpoints/master-data/master-data.msw";
import { getOrdersListMockHandler } from "@/lib/api/generated/endpoints/orders/orders.msw";
import type {
  MasterDataCustomers200,
  OrdersList200,
  OrdersList200DataItem,
} from "@/lib/api/generated/model";
import { useSessionStore } from "@/stores/session";
import { axeViolations } from "@/test/axe";
import { errorBody, sessionFor } from "@/test/fixtures";
import { server } from "@/test/server";
import OrdersPage from "./OrdersPage";

const shown = (value: string): OrdersList200DataItem["amount"] => ({
  field: "item.unitPrice",
  classification: "confidential" as const,
  masked: false,
  value,
  reason: null,
});

const hidden: OrdersList200DataItem["amount"] = {
  field: "item.unitPrice",
  classification: "restricted" as const,
  masked: true,
  value: null,
  reason: "price" as const,
};

const sample = (
  n: number,
  amount = shown("1200.00"),
): OrdersList200DataItem => ({
  orderNo: `SO-000${String(n)}`,
  source: "sample" as const,
  captureState: null,
  customerNo: "C-0001",
  customerName: "Alpha Synthetic Ltd",
  externalDocumentNo: `PO-${String(n)}`,
  orderDate: "2026-10-20",
  shipmentDate: null,
  workflowStatus: "Packing",
  amount,
  currencyCode: "USD",
  shortage: null,
  shortageCount: 0,
});

const stored: OrdersList200DataItem = {
  ...sample(1),
  orderNo: "SO-20261108-0001",
  source: "stored" as const,
  captureState: "draft" as const,
  workflowStatus: null,
  shortage: {
    itemNo: "I-0004",
    ordered: "10.000",
    availableStock: "4.000",
    shortBy: "6.000",
  },
  shortageCount: 3,
};

const page = (
  rows: OrdersList200DataItem[],
  total = rows.length,
): OrdersList200 => ({
  data: rows,
  meta: { page: 1, pageSize: 25, total },
});

const customers = {
  data: [{ no: "C-0001", name: "Synthetic Systems" }],
  meta: { page: 1, pageSize: 200, total: 1, mock: true },
} as MasterDataCustomers200;

const load = () =>
  i18n.loadNamespaces(["orders", "common", "components", "list-page"]);

function renderAt(path = "/orders", role: "SUPPORT" | "WAREHOUSE" = "SUPPORT") {
  useSessionStore.getState().setSession(sessionFor(role));
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <OrdersPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("the Orders list", () => {
  it("lists samples with a Sample tag and a link, and a stored order without a link", async () => {
    await load();
    server.use(
      getMasterDataCustomersMockHandler(customers),
      getOrdersListMockHandler(page([sample(1), stored])),
    );
    const view = renderAt();
    expect(
      await screen.findByRole("link", { name: "SO-0001" }),
    ).toHaveAttribute("href", "/order-tracker/SO-0001");
    expect(screen.getByText("Sample")).toBeInTheDocument();
    expect(screen.getByText("SO-20261108-0001")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "SO-20261108-0001" })).toBeNull();
    expect(
      within(screen.getByRole("table")).getByText("Draft"),
    ).toBeInTheDocument();
    expect(screen.getByText("Synthetic demo data")).toBeInTheDocument();
    expect(screen.getAllByText(/USD\s?1,200\.00/)).toHaveLength(2);
    expect(screen.queryByRole("button", { name: /^New/ })).toBeNull();
    expect(await axeViolations(view.container)).toEqual([]);
  });

  it("says by how much an order is short, and of how many items, without a button to order", async () => {
    await load();
    server.use(
      getMasterDataCustomersMockHandler(customers),
      getOrdersListMockHandler(page([stored])),
    );
    renderAt();
    expect(await screen.findByText(/Short by 6 of I-0004/)).toBeVisible();
    expect(screen.getByText(/and 2 more items/)).toBeVisible();
    expect(
      screen.queryByRole("button", { name: /order stock|raise|purchase/i }),
    ).toBeNull();
  });

  it("shows dots with the reason where a role may not see amounts", async () => {
    await load();
    server.use(
      getMasterDataCustomersMockHandler(customers),
      getOrdersListMockHandler(page([sample(1, hidden)])),
    );
    renderAt("/orders", "WAREHOUSE");
    await screen.findByRole("link", { name: "SO-0001" });
    expect(screen.queryByText(/1,200/)).toBeNull();
    expect(screen.getAllByLabelText("Hidden").length).toBeGreaterThan(0);
  });

  it("sends the waiting filter in the link to the server, and drops a free-text value", async () => {
    await load();
    const seen: string[] = [];
    server.use(
      getMasterDataCustomersMockHandler(customers),
      http.get("*/api/v1/orders", ({ request }) => {
        seen.push(new URL(request.url).search);
        return HttpResponse.json(page([stored]));
      }),
    );
    const first = renderAt("/orders?stock=waiting");
    await screen.findByText("SO-20261108-0001");
    expect(seen[0]).toContain("stock=waiting");
    first.unmount();
    seen.length = 0;
    renderAt("/orders?stock=true");
    await screen.findByText("SO-20261108-0001");
    await waitFor(() => {
      expect(seen.length).toBeGreaterThan(0);
    });
    expect(seen[0]).not.toContain("stock=");
  });

  it("stops sending an amount sort once the amounts are masked", async () => {
    await load();
    const seen: string[] = [];
    server.use(
      getMasterDataCustomersMockHandler(customers),
      http.get("*/api/v1/orders", ({ request }) => {
        seen.push(new URL(request.url).search);
        return HttpResponse.json(page([sample(1, hidden)]));
      }),
    );
    renderAt("/orders?sort=amount&direction=desc", "WAREHOUSE");
    await screen.findByRole("link", { name: "SO-0001" });
    await waitFor(() => {
      expect(seen.at(-1)).not.toContain("sort=");
    });
  });

  it("shows the error with its trace id and a retry", async () => {
    await load();
    server.use(
      getMasterDataCustomersMockHandler(customers),
      http.get("*/api/v1/orders", () =>
        HttpResponse.json(errorBody("INTERNAL_ERROR", "trace-orders-1"), {
          status: 500,
        }),
      ),
    );
    renderAt();
    const alert = await screen.findByRole("alert");
    expect(within(alert).getByText("trace-orders-1")).toBeInTheDocument();
    expect(
      within(alert).getByRole("button", { name: "Try again" }),
    ).toBeVisible();
  });

  it("says access is denied when the server refuses", async () => {
    await load();
    server.use(
      getMasterDataCustomersMockHandler(customers),
      http.get("*/api/v1/orders", () =>
        HttpResponse.json(errorBody("FORBIDDEN", "trace-orders-2"), {
          status: 403,
        }),
      ),
    );
    renderAt();
    expect(
      await screen.findByText("You do not have access to this"),
    ).toBeVisible();
  });

  it("names the next step when there are no orders at all", async () => {
    await load();
    server.use(
      getMasterDataCustomersMockHandler(customers),
      getOrdersListMockHandler(page([])),
    );
    renderAt();
    expect(await screen.findByText("No orders yet")).toBeVisible();
  });

  it("offers to clear the filters when none match", async () => {
    await load();
    server.use(
      getMasterDataCustomersMockHandler(customers),
      getOrdersListMockHandler(page([])),
    );
    renderAt("/orders?source=stored");
    expect(await screen.findByText("No results match")).toBeVisible();
    expect(
      screen.getAllByRole("button", { name: "Clear search and filters" })
        .length,
    ).toBeGreaterThan(0);
  });
});
