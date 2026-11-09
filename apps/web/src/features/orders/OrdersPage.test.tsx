import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { MemoryRouter, Route, Routes, useLocation } from "react-router";
import userEvent from "@testing-library/user-event";
import type { Role } from "@orderpilot/shared";
import { useGlobalShortcuts } from "@/app/shell/shortcuts";
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
import { orderColumns } from "./orderColumns";

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

const HERE = "here";

/** Draws where the router is, and turns on the N key as the app shell does. */
function Probe() {
  useGlobalShortcuts();
  return <output aria-label={HERE}>{useLocation().pathname}</output>;
}

function renderAt(path = "/orders", role: Role = "SUPPORT") {
  useSessionStore.getState().setSession(sessionFor(role));
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <Probe />
        <Routes>
          <Route path="/orders" element={<OrdersPage />} />
          <Route path="/orders/new" element={<main />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("the Orders list", () => {
  it("lists samples with a Sample tag and a link, and a stored order with a link to its own page", async () => {
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
    expect(
      screen.getByRole("link", { name: "SO-20261108-0001" }),
    ).toHaveAttribute("href", "/orders/SO-20261108-0001");
    // Twice: the Entry column, and the chip beside the number for a phone.
    const drafts = within(screen.getByRole("table")).getAllByText("Draft");
    expect(drafts).toHaveLength(2);
    expect(drafts.some((d) => d.closest('[class~="md:hidden"]'))).toBe(true);
    expect(screen.getByText("Synthetic demo data")).toBeInTheDocument();
    expect(screen.getAllByText(/USD\s?1,200\.00/)).toHaveLength(2);
    expect(screen.getByRole("button", { name: "New order" })).toBeVisible();
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

  it("never cuts the shortage: the whole sentence, with the other items, is in the list", async () => {
    await load();
    server.use(
      getMasterDataCustomersMockHandler(customers),
      getOrdersListMockHandler(page([stored])),
    );
    renderAt();
    const line = await screen.findByText(
      "Short by 6 of I-0004 and 2 more items",
    );
    expect(line.parentElement?.className).toContain("whitespace-normal");
  });

  it("exports the same Stock text as the screen, with grouped numbers and the other items", async () => {
    await load();
    const t = i18n.getFixedT("en", "orders");
    const long: OrdersList200DataItem = {
      ...stored,
      shortage: {
        itemNo: "I-0004",
        ordered: "1260.000",
        availableStock: "10.000",
        shortBy: "1250.000",
      },
    };
    const stock = orderColumns(t, false).find((c) => c.id === "stock");
    expect(stock?.exportValue?.(long)).toBe(
      "Short by 1,250 of I-0004 and 2 more items",
    );
    expect(stock?.exportValue?.(sample(1))).toBe("");
  });

  it("starts with the PO number, the order date and the shipment date under Columns", () => {
    const t = i18n.getFixedT("en", "orders");
    const hiddenIds = orderColumns(t, false)
      .filter((c) => c.defaultHidden)
      .map((c) => c.id);
    expect(hiddenIds).toEqual([
      "externalDocumentNo",
      "orderDate",
      "shipmentDate",
    ]);
  });

  it("exports the amount with its currency, and the dots word when it is hidden", () => {
    const t = i18n.getFixedT("en", "orders");
    const amount = orderColumns(t, false).find((c) => c.id === "amount");
    expect(amount?.exportValue?.(sample(1))).toBe("USD 1200.00");
    expect(amount?.exportValue?.(sample(1, hidden))).toBe("Hidden");
  });

  it("shows the customer's name beside its number", async () => {
    await load();
    server.use(
      getMasterDataCustomersMockHandler(customers),
      getOrdersListMockHandler(page([sample(1)])),
    );
    renderAt();
    await screen.findByRole("link", { name: "SO-0001" });
    expect(screen.getByText("C-0001")).toBeVisible();
    expect(screen.getByText("Alpha Synthetic Ltd")).toBeVisible();
  });

  it("puts what a phone shows first: the order, its shortage and its amount", async () => {
    await load();
    const t = i18n.getFixedT("en", "orders");
    expect(
      orderColumns(t, false)
        .slice(0, 3)
        .map((column) => column.id),
    ).toEqual(["orderNo", "stock", "amount"]);
  });

  it("draws a Submitted order in the neutral chip and a Void one struck through, never as approved", async () => {
    await load();
    server.use(
      getMasterDataCustomersMockHandler(customers),
      getOrdersListMockHandler(
        page([
          { ...stored, orderNo: "SO-20261108-0002", captureState: "submitted" },
          { ...stored, orderNo: "SO-20261108-0003", captureState: "void" },
        ]),
      ),
    );
    renderAt();
    await screen.findByText("SO-20261108-0002");
    const table = within(screen.getByRole("table"));
    const submitted = table.getAllByText("Submitted").at(0);
    expect(submitted?.closest("[data-family]")).toHaveAttribute(
      "data-family",
      "neutral",
    );
    const voided = table.getAllByText("Void").at(0)?.closest("[data-family]");
    expect(voided).not.toHaveAttribute("data-family", "ready");
    expect(voided?.className).toContain("line-through");
  });

  it("gives a sample and a stored order each a row menu, since each opens a page", async () => {
    await load();
    server.use(
      getMasterDataCustomersMockHandler(customers),
      getOrdersListMockHandler(page([sample(1), stored])),
    );
    renderAt();
    await screen.findByRole("link", { name: "SO-0001" });
    expect(
      screen.getByRole("button", { name: "Actions for SO-0001" }),
    ).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Actions for SO-20261108-0001" }),
    ).toBeVisible();
  });

  it.each(["SUPPORT", "PRODUCT_MANAGER"] as const)(
    "gives %s one primary button, New order, and the N key goes to the form",
    async (role) => {
      await load();
      const user = userEvent.setup();
      server.use(
        getMasterDataCustomersMockHandler(customers),
        getOrdersListMockHandler(page([sample(1)])),
      );
      const view = renderAt("/orders", role);
      await screen.findByRole("link", { name: "SO-0001" });
      const primary = view.container.querySelectorAll(
        'button[data-variant="default"]',
      );
      expect(primary).toHaveLength(1);
      expect(primary[0]).toHaveTextContent("New order");
      await user.keyboard("n");
      expect(screen.getByLabelText(HERE)).toHaveTextContent("/orders/new");
    },
  );

  it.each(["WAREHOUSE", "AUDITOR"] as const)(
    "shows %s no New order button, and the N key does nothing",
    async (role) => {
      await load();
      const user = userEvent.setup();
      server.use(
        getMasterDataCustomersMockHandler(customers),
        getOrdersListMockHandler(page([sample(1)])),
      );
      renderAt("/orders", role);
      await screen.findByRole("link", { name: "SO-0001" });
      expect(screen.queryByRole("button", { name: /^New/ })).toBeNull();
      await user.keyboard("n");
      expect(screen.getByLabelText(HERE)).toHaveTextContent("/orders");
      expect(screen.getByLabelText(HERE)).not.toHaveTextContent("/orders/new");
    },
  );

  it("sends the date range and the customer from the address to the server", async () => {
    await load();
    const seen: string[] = [];
    server.use(
      getMasterDataCustomersMockHandler(customers),
      http.get("*/api/v1/orders", ({ request }) => {
        seen.push(new URL(request.url).search);
        return HttpResponse.json(page([sample(1)]));
      }),
    );
    renderAt(
      "/orders?orderDateFrom=2026-10-01&orderDateTo=2026-10-31&customerNo=C-0001",
    );
    await screen.findByRole("link", { name: "SO-0001" });
    expect(seen[0]).toContain("orderDateFrom=2026-10-01");
    expect(seen[0]).toContain("orderDateTo=2026-10-31");
    expect(seen[0]).toContain("customerNo=C-0001");
  });

  it("still lists the orders when the customer filter cannot load", async () => {
    await load();
    server.use(
      http.get("*/api/v1/master-data/customers", () =>
        HttpResponse.json(errorBody("INTERNAL_ERROR", "trace-orders-3"), {
          status: 500,
        }),
      ),
      getOrdersListMockHandler(page([sample(1)])),
    );
    renderAt();
    expect(await screen.findByRole("link", { name: "SO-0001" })).toBeVisible();
  });
});
