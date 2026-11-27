import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { MemoryRouter, useLocation } from "react-router";
import { describe, expect, it } from "vitest";
import i18n from "@/i18n";
import { getExceptionsListMockHandler } from "@/lib/api/generated/endpoints/exceptions/exceptions.msw";
import type { ExceptionsList200 } from "@/lib/api/generated/model";
import { axeViolations } from "@/test/axe";
import { errorBody } from "@/test/fixtures";
import { server } from "@/test/server";
import ExceptionsPage from "./ExceptionsPage";

const queue = (rows: object[]) =>
  ({
    data: rows,
    meta: { page: 1, pageSize: 10, total: rows.length, mock: true },
  }) as ExceptionsList200;

const mismatch = {
  id: "e1",
  orderNo: "SO-0007",
  customerNo: "C0007",
  customerName: "Harbour Marine Supply",
  ruleId: "mock.sample-quantity",
  ruleLabel: "Packing list quantity against the PO (sample result)",
  summary: "Item 1000: the packing list says 40, the PO says 50",
  expected: "50",
  actual: "40",
  difference: "-10",
  tolerance: { label: "Quantity difference (units)", value: "0" },
  fixBy: "SUPPORT",
  state: "OPEN",
  openedAt: "2026-10-02T09:00:00.000Z",
};

function Where() {
  return <p data-testid="where">{useLocation().pathname}</p>;
}

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <ExceptionsPage />
        <Where />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("the exceptions queue", () => {
  it("says what differs, by how much and who should fix it", async () => {
    await i18n.loadNamespaces(["exceptions", "common"]);
    server.use(getExceptionsListMockHandler(queue([mismatch])));
    const view = renderPage();
    expect(await screen.findByText("Item 1000")).toBeVisible();
    expect(screen.getByText("PL: 40 \u00b7 PO: 50")).toBeVisible();
    expect(screen.getByText("10 units fewer")).toBeVisible();
    expect(screen.getByText("PL vs PO")).toBeVisible();
    expect(screen.queryByText(/sample result/)).toBeNull();
    expect(screen.getByText("Support")).toBeVisible();
    expect(screen.getByText("Mock")).toBeVisible();
    expect(screen.getByRole("link", { name: "SO-0007" })).toHaveAttribute(
      "href",
      "/orders/SO-0007",
    );
    expect(
      screen.getByRole("columnheader", { name: /Order No\./ }),
    ).toBeVisible();
    expect(
      screen.getByRole("columnheader", { name: "Discrepancy" }),
    ).toBeVisible();
    expect(await axeViolations(view.container)).toEqual([]);
  });

  it("keeps singular/plural grammar clean on the variance pill", async () => {
    await i18n.loadNamespaces(["exceptions", "common"]);
    const oneUnitOff = {
      ...mismatch,
      id: "e2",
      summary: "Item 1001: the packing list says 19, the PO says 20",
      difference: "-1",
    };
    server.use(getExceptionsListMockHandler(queue([oneUnitOff])));
    renderPage();
    expect(await screen.findByText("1 unit fewer")).toBeVisible();
    expect(screen.queryByText(/\bunits\b/)).toBeNull();
  });

  it("drops the redundant 'than the PO' from an already-worded variance", async () => {
    await i18n.loadNamespaces(["exceptions", "common"]);
    const worded = {
      ...mismatch,
      id: "e5",
      summary: "Item I-0202: the packing list says 138, the PO says 153",
      difference: "15 units fewer than the PO",
    };
    server.use(getExceptionsListMockHandler(queue([worded])));
    renderPage();
    expect(await screen.findByText("15 units fewer")).toBeVisible();
    expect(screen.queryByText(/than the PO/)).toBeNull();
  });

  it("formats the shipping check as the bill of lading's due date", async () => {
    await i18n.loadNamespaces(["exceptions", "common"]);
    const awb = {
      ...mismatch,
      id: "e3",
      ruleId: "mock.sample-shipping",
      ruleLabel: "Shipping document received on time (sample result)",
      summary: "The bill of lading was due on 2026-11-09 and has not arrived",
      expected: "2026-11-09",
      actual: "",
      difference: "2 days late",
      tolerance: { label: "Shipping delay (days)", value: "0" },
    };
    server.use(getExceptionsListMockHandler(queue([awb])));
    renderPage();
    expect(await screen.findByText("Bill of lading")).toBeVisible();
    expect(screen.getByText("Due 9 Nov 2026")).toBeVisible();
    expect(screen.getByText("2 days late")).toBeVisible();
  });

  it("formats the price check as PI against PO, in dollars", async () => {
    await i18n.loadNamespaces(["exceptions", "common"]);
    const price = {
      ...mismatch,
      id: "e4",
      ruleId: "mock.sample-price",
      ruleLabel: "Unit price on the PI against the PO (sample result)",
      summary: "Item I-0221: the PI shows 92.28, the PO shows 90.78",
      expected: "90.78",
      actual: "92.28",
      difference: "+$1.50 / unit",
      tolerance: { label: "Unit price difference (USD)", value: "0" },
    };
    server.use(getExceptionsListMockHandler(queue([price])));
    renderPage();
    expect(await screen.findByText("Item I-0221")).toBeVisible();
    expect(screen.getByText("PI: $92.28 \u00b7 PO: $90.78")).toBeVisible();
    expect(screen.getByText("+$1.50 / unit")).toBeVisible();
  });

  it("sorts the rows on screen by order number when its header is clicked", async () => {
    await i18n.loadNamespaces(["exceptions", "common"]);
    const first = { ...mismatch, id: "e6", orderNo: "SO-0009" };
    const second = { ...mismatch, id: "e7", orderNo: "SO-0002" };
    server.use(getExceptionsListMockHandler(queue([first, second])));
    renderPage();
    await screen.findByRole("link", { name: "SO-0009" });
    const orderOf = (link: HTMLElement) =>
      within(link.closest("tr") ?? link).queryByRole("link")?.textContent;
    const rowsBefore = screen.getAllByRole("row").slice(1);
    expect(rowsBefore.map((r) => orderOf(r))).toEqual(["SO-0009", "SO-0002"]);

    await userEvent.click(screen.getByRole("button", { name: "Order No." }));
    await waitFor(() => {
      const rowsAfter = screen.getAllByRole("row").slice(1);
      expect(rowsAfter.map((r) => orderOf(r))).toEqual(["SO-0002", "SO-0009"]);
    });
  });

  it("narrows the rows on screen to one check from the Check column's own filter", async () => {
    await i18n.loadNamespaces(["exceptions", "common"]);
    const quantity = { ...mismatch, id: "e8", orderNo: "SO-0009" };
    const price = {
      ...mismatch,
      id: "e9",
      orderNo: "SO-0010",
      ruleLabel: "Unit price on the PI against the PO (sample result)",
    };
    server.use(getExceptionsListMockHandler(queue([quantity, price])));
    renderPage();
    await screen.findByRole("link", { name: "SO-0009" });
    expect(screen.getByRole("link", { name: "SO-0010" })).toBeVisible();

    await userEvent.click(
      screen.getByRole("button", { name: "Filter by check" }),
    );
    await userEvent.click(
      await screen.findByRole("menuitemradio", { name: "PI vs PO" }),
    );
    await waitFor(() => {
      expect(screen.queryByRole("link", { name: "SO-0009" })).toBeNull();
    });
    expect(screen.getByRole("link", { name: "SO-0010" })).toBeVisible();
  });

  it("opens the order when the row itself is clicked, away from its link", async () => {
    await i18n.loadNamespaces(["exceptions", "common"]);
    server.use(getExceptionsListMockHandler(queue([mismatch])));
    renderPage();
    await userEvent.click(await screen.findByText("10 units fewer"));
    // The tab logic loads on first use, so the move arrives a moment later.
    await waitFor(() => {
      expect(screen.getByTestId("where")).toHaveTextContent("/orders/SO-0007");
    });
  });

  it("shows the open exceptions by default, and every state once the chip is cleared", async () => {
    await i18n.loadNamespaces(["exceptions", "common"]);
    const asked: (string | null)[] = [];
    server.use(
      http.get("*/api/v1/exceptions", ({ request }) => {
        asked.push(new URL(request.url).searchParams.get("state"));
        return HttpResponse.json(queue([mismatch]));
      }),
    );
    renderPage();
    const clear = await screen.findByRole("button", {
      name: "Clear filter: Open",
    });
    expect(asked.at(-1)).toBe("OPEN");
    fireEvent.click(clear);
    await waitFor(() => {
      expect(asked.at(-1)).toBe("ALL");
    });
    expect(
      screen.queryByRole("button", { name: "Clear filter: Open" }),
    ).toBeNull();
  });

  it("shows an empty queue with a next step", async () => {
    await i18n.loadNamespaces(["exceptions", "common"]);
    server.use(getExceptionsListMockHandler(queue([])));
    renderPage();
    expect(await screen.findByText("No exceptions")).toBeVisible();
    expect(screen.getByRole("link", { name: "Open orders" })).toBeVisible();
  });

  it("shows the error with its trace id", async () => {
    await i18n.loadNamespaces(["exceptions", "common"]);
    server.use(
      http.get("*/api/v1/exceptions", () =>
        HttpResponse.json(errorBody("INTERNAL_ERROR", "trace-exc-1"), {
          status: 500,
        }),
      ),
    );
    renderPage();
    const alert = await screen.findByRole("alert");
    expect(within(alert).getByText("trace-exc-1")).toBeInTheDocument();
  });

  it("shows permission denied when the API refuses the role", async () => {
    await i18n.loadNamespaces(["exceptions", "common"]);
    server.use(
      http.get("*/api/v1/exceptions", () =>
        HttpResponse.json(errorBody("FORBIDDEN"), { status: 403 }),
      ),
    );
    renderPage();
    expect(
      await screen.findByText("You do not have access to this"),
    ).toBeVisible();
  });
});
