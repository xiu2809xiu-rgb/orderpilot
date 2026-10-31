import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { MemoryRouter } from "react-router";
import { describe, expect, it } from "vitest";
import i18n from "@/i18n";
import { getTrackerListMockHandler } from "@/lib/api/generated/endpoints/tracker/tracker.msw";
import type { TrackerList200 } from "@/lib/api/generated/model";
import { axeViolations } from "@/test/axe";
import { errorBody } from "@/test/fixtures";
import { server } from "@/test/server";
import OrderTrackerPage from "./OrderTrackerPage";

const row = (n: number, overdue = false) => ({
  orderNo: `SO-000${String(n)}`,
  externalDocumentNo: `PO-${String(n)}`,
  customerNo: `C0${String(n)}`,
  customerName: `Customer ${String(n)}`,
  status: { code: "sample", label: `Status ${String(n)}` },
  ownerRole: "SUPPORT" as const,
  overdue: overdue
    ? { overdue: true, daysOverdue: 3, reason: "AWB was due" }
    : { overdue: false, daysOverdue: 0, reason: null },
  openExceptions: 0,
  shipmentDate: null,
  orderDate: "2026-10-01",
});

const page = (rows: ReturnType<typeof row>[], total = rows.length) =>
  ({
    data: rows,
    meta: { page: 1, pageSize: 10, total, mock: true },
  }) as TrackerList200;

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <OrderTrackerPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("the order tracker", () => {
  it("lists orders from the API with the Mock badge and no axe violations", async () => {
    await i18n.loadNamespaces(["order-tracker", "common"]);
    server.use(getTrackerListMockHandler(page([row(1), row(2, true)])));
    const view = renderPage();
    expect(await screen.findByText("Status 1")).toBeInTheDocument();
    expect(screen.getByText("Mock")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "SO-0001" })).toHaveAttribute(
      "href",
      "/order-tracker/SO-0001",
    );
    expect(screen.getByText("3 days overdue")).toBeInTheDocument();
    expect(await axeViolations(view.container)).toEqual([]);
  });

  it("asks the server for the next page, the search and the overdue filter", async () => {
    await i18n.loadNamespaces(["order-tracker", "common"]);
    const seen: string[] = [];
    server.use(
      http.get("*/api/v1/tracker/orders", ({ request }) => {
        seen.push(new URL(request.url).search);
        return HttpResponse.json(page([row(1)], 30));
      }),
    );
    renderPage();
    await screen.findByText("Status 1");
    await userEvent.click(screen.getByRole("button", { name: "Next page" }));
    await userEvent.click(screen.getByRole("switch", { name: "Overdue only" }));
    await screen.findByText("Status 1");
    expect(seen[0]).toContain("page=1");
    expect(seen.some((search) => search.includes("page=2"))).toBe(true);
    expect(seen.at(-1)).toContain("overdue=true");
    expect(seen.at(-1)).toContain("page=1");
  });

  it("shows an empty state with a next step", async () => {
    await i18n.loadNamespaces(["order-tracker", "common"]);
    server.use(getTrackerListMockHandler(page([])));
    renderPage();
    expect(await screen.findByText("No orders to track yet")).toBeVisible();
    expect(
      screen.getByRole("link", { name: "Open the orders list" }),
    ).toBeVisible();
  });

  it("shows the error with its trace id and a retry", async () => {
    await i18n.loadNamespaces(["order-tracker", "common"]);
    server.use(
      http.get("*/api/v1/tracker/orders", () =>
        HttpResponse.json(errorBody("INTERNAL_ERROR", "trace-tracker-1"), {
          status: 500,
        }),
      ),
    );
    renderPage();
    const alert = await screen.findByRole("alert");
    expect(within(alert).getByText("trace-tracker-1")).toBeInTheDocument();
    expect(
      within(alert).getByRole("button", { name: "Try again" }),
    ).toBeVisible();
  });

  it("shows permission denied when the API refuses the role", async () => {
    await i18n.loadNamespaces(["order-tracker", "common"]);
    server.use(
      http.get("*/api/v1/tracker/orders", () =>
        HttpResponse.json(errorBody("FORBIDDEN", "trace-denied-1"), {
          status: 403,
        }),
      ),
    );
    renderPage();
    expect(
      await screen.findByText(/permission|not allowed|access/i),
    ).toBeVisible();
  });
});
