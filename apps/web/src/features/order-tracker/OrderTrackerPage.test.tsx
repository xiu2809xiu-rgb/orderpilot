import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { MemoryRouter, useLocation } from "react-router";
import { describe, expect, it } from "vitest";
import i18n from "@/i18n";
import { getTrackerListMockHandler } from "@/lib/api/generated/endpoints/tracker/tracker.msw";
import type { TrackerList200 } from "@/lib/api/generated/model";
import { axeViolations } from "@/test/axe";
import { errorBody } from "@/test/fixtures";
import { server } from "@/test/server";
import OrderTrackerPage from "./OrderTrackerPage";

const row = (n: number, overdue = false, exceptions = 0) => ({
  orderNo: `SO-000${String(n)}`,
  externalDocumentNo: `PO-${String(n)}`,
  customerNo: `C0${String(n)}`,
  customerName: `Customer ${String(n)}`,
  status: { code: "sample", label: `Status ${String(n)}` },
  ownerRole: "SUPPORT" as const,
  overdue: overdue
    ? { overdue: true, daysOverdue: 3, reason: "AWB was due" }
    : { overdue: false, daysOverdue: 0, reason: null },
  openExceptions: exceptions,
  shipmentDate: null,
  orderDate: "2026-10-01",
});

const page = (rows: ReturnType<typeof row>[], total = rows.length) =>
  ({
    data: rows,
    meta: { page: 1, pageSize: 10, total, mock: true },
  }) as TrackerList200;

function Where() {
  return <p data-testid="where">{useLocation().pathname}</p>;
}

function renderPage(link = "/order-tracker") {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[link]}>
        <OrderTrackerPage />
        <Where />
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

  it("opens the order when the row itself is clicked, away from its link", async () => {
    await i18n.loadNamespaces(["order-tracker", "common"]);
    server.use(getTrackerListMockHandler(page([row(1), row(2)])));
    renderPage();
    await userEvent.click(await screen.findByText("Status 2"));
    // The tab logic loads on first use, so the move arrives a moment later.
    await waitFor(() => {
      expect(screen.getByTestId("where")).toHaveTextContent(
        "/order-tracker/SO-0002",
      );
    });
  });

  it("asks the server for the next page, the search and the overdue filter", async () => {
    await i18n.loadNamespaces(["order-tracker", "common"]);
    // The lifecycle stage tabs ask for their own counts (`pageSize=1`) on the
    // same endpoint: this test only tracks the table's own requests.
    const seen: string[] = [];
    server.use(
      http.get("*/api/v1/tracker/orders", ({ request }) => {
        const url = new URL(request.url);
        if (url.searchParams.get("pageSize") !== "1") seen.push(url.search);
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

  it("asks the server for the exceptions-only filter, resets to page 1, and combines with overdue", async () => {
    await i18n.loadNamespaces(["order-tracker", "common"]);
    const seen: string[] = [];
    server.use(
      http.get("*/api/v1/tracker/orders", ({ request }) => {
        const url = new URL(request.url);
        if (url.searchParams.get("pageSize") !== "1") seen.push(url.search);
        return HttpResponse.json(page([row(1)], 30));
      }),
    );
    renderPage();
    await screen.findByText("Status 1");
    await userEvent.click(screen.getByRole("button", { name: "Next page" }));
    await userEvent.click(
      screen.getByRole("switch", { name: "Exceptions only" }),
    );
    await screen.findByText("Status 1");
    // Ticking the switch dropped the page back to 1, and the request asks
    // for exceptions only.
    expect(seen.at(-1)).toContain("exceptionsOnly=true");
    expect(seen.at(-1)).toContain("page=1");
    // It combines with the overdue toggle rather than replacing it.
    await userEvent.click(screen.getByRole("switch", { name: "Overdue only" }));
    await screen.findByText("Status 1");
    expect(seen.at(-1)).toContain("exceptionsOnly=true");
    expect(seen.at(-1)).toContain("overdue=true");
  });

  it("opens from a link with its search and its overdue filter, and shows the filter as a chip", async () => {
    await i18n.loadNamespaces(["order-tracker", "common"]);
    // Same as above: ignore the stage tabs' own `pageSize=1` count requests.
    const seen: string[] = [];
    server.use(
      http.get("*/api/v1/tracker/orders", ({ request }) => {
        const url = new URL(request.url);
        if (url.searchParams.get("pageSize") !== "1") seen.push(url.search);
        return HttpResponse.json(page([row(1)]));
      }),
    );
    renderPage("/order-tracker?search=C-0001&overdue=true");
    await screen.findByText("Status 1");
    expect(seen[0]).toContain("search=C-0001");
    expect(seen[0]).toContain("overdue=true");
    expect(screen.getByRole("searchbox", { name: "Search" })).toHaveValue(
      "C-0001",
    );
    expect(screen.getByRole("switch", { name: "Overdue only" })).toBeChecked();
  });

  it("shows the lifecycle stage tabs with their counts, and filters by stage on click", async () => {
    await i18n.loadNamespaces(["order-tracker", "common"]);
    server.use(getTrackerListMockHandler(page([row(1)], 7)));
    renderPage();
    await screen.findByText("Status 1");
    const tabs = screen.getByRole("tablist", { name: "Lifecycle stage" });
    const allTab = within(tabs).getByRole("tab", { name: /All \(7\)/ });
    expect(allTab).toHaveAttribute("aria-selected", "true");
    const shippedTab = within(tabs).getByRole("tab", { name: /^Shipped/ });
    await userEvent.click(shippedTab);
    // The active tab is driven by the URL filter, not by the response the
    // mock happens to send back, so it switches as soon as the click lands.
    await waitFor(() => {
      expect(shippedTab).toHaveAttribute("aria-selected", "true");
    });
    expect(allTab).toHaveAttribute("aria-selected", "false");
  });

  it("disables the Status column's filter until a stage tab (not All) is open", async () => {
    await i18n.loadNamespaces(["order-tracker", "common"]);
    server.use(getTrackerListMockHandler(page([row(1)], 2)));
    renderPage();
    await screen.findByText("Status 1");
    expect(
      screen.getByRole("button", { name: "Filter by sub-status" }),
    ).toBeDisabled();
  });

  it("narrows a stage to one status from the Status column's own filter, and keeps the stage's tab active", async () => {
    await i18n.loadNamespaces(["order-tracker", "common"]);
    server.use(getTrackerListMockHandler(page([row(1)], 2)));
    renderPage();
    await screen.findByText("Status 1");
    const tabs = screen.getByRole("tablist", { name: "Lifecycle stage" });
    const shippedTab = within(tabs).getByRole("tab", { name: /^Shipped/ });
    // The Status column's filter only opens once its own tab is the one open.
    await userEvent.click(shippedTab);
    const statusFilter = screen.getByRole("button", {
      name: "Filter by sub-status",
    });
    expect(statusFilter).toBeEnabled();
    await userEvent.click(statusFilter);
    await userEvent.click(
      await screen.findByRole("menuitemradio", {
        name: "Shipped, AWB overdue",
      }),
    );
    await waitFor(() => {
      expect(shippedTab).toHaveAttribute("aria-selected", "true");
    });
    // The single status picked from the menu, not the whole stage, shows as
    // the active filter chip.
    expect(
      screen.getByText("Status: Shipped, AWB overdue"),
    ).toBeInTheDocument();
  });

  it("shows no status chip when a stage tab's whole group is selected", async () => {
    await i18n.loadNamespaces(["order-tracker", "common", "components"]);
    server.use(getTrackerListMockHandler(page([row(1)], 2)));
    renderPage();
    await screen.findByText("Status 1");
    const tabs = screen.getByRole("tablist", { name: "Lifecycle stage" });
    await userEvent.click(within(tabs).getByRole("tab", { name: /^Shipped/ }));
    await waitFor(() => {
      expect(
        within(tabs).getByRole("tab", { name: /^Shipped/ }),
      ).toHaveAttribute("aria-selected", "true");
    });
    expect(screen.queryByText(/^Status:/)).not.toBeInTheDocument();
  });

  it("shows a Status chip once narrowed, and clearing it resets to the whole stage rather than away from it", async () => {
    await i18n.loadNamespaces(["order-tracker", "common", "components"]);
    server.use(getTrackerListMockHandler(page([row(1)], 2)));
    renderPage();
    await screen.findByText("Status 1");
    const tabs = screen.getByRole("tablist", { name: "Lifecycle stage" });
    const shippedTab = within(tabs).getByRole("tab", { name: /^Shipped/ });
    await userEvent.click(shippedTab);
    await userEvent.click(
      screen.getByRole("button", { name: "Filter by sub-status" }),
    );
    await userEvent.click(
      await screen.findByRole("menuitemradio", {
        name: "Shipped, AWB overdue",
      }),
    );
    expect(
      screen.getByText("Status: Shipped, AWB overdue"),
    ).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("button", { name: /Clear filter: Status/ }),
    );
    // Clearing the chip drops back to the stage's whole group: the tab
    // stays open, it just no longer says one status in particular.
    expect(
      screen.queryByText("Status: Shipped, AWB overdue"),
    ).not.toBeInTheDocument();
    expect(shippedTab).toHaveAttribute("aria-selected", "true");
  });

  it("shows a red exceptions badge beside the order number only when there are open exceptions", async () => {
    await i18n.loadNamespaces(["order-tracker", "common"]);
    server.use(
      getTrackerListMockHandler(page([row(1, false, 0), row(2, false, 3)])),
    );
    renderPage();
    await screen.findByText("Status 1");
    expect(
      screen.queryByText("No orders to track yet"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("columnheader", { name: "Open exceptions" }),
    ).not.toBeInTheDocument();
    const clean = screen.getByRole("link", { name: "SO-0001" });
    expect(
      within(clean.closest("td") ?? clean).queryByLabelText(/open exception/),
    ).toBeNull();
    const flagged = screen.getByRole("link", { name: "SO-0002" });
    const badge = within(flagged.closest("td") ?? flagged).getByLabelText(
      "3 open exceptions",
    );
    expect(badge).toHaveTextContent("3");
  });

  it("shows an empty state that names what is missing", async () => {
    await i18n.loadNamespaces(["order-tracker", "common"]);
    server.use(getTrackerListMockHandler(page([])));
    renderPage();
    expect(await screen.findByText("No orders to track yet")).toBeVisible();
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
