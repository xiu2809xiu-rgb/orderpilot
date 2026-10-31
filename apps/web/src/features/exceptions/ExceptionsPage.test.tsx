import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { MemoryRouter } from "react-router";
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
  tolerance: { label: "Quantity difference (sample value)", value: "0" },
  fixBy: "SUPPORT",
  state: "OPEN",
  openedAt: "2026-10-02T09:00:00.000Z",
};

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <ExceptionsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("the exceptions queue", () => {
  it("says what differs, by how much and who should fix it", async () => {
    await i18n.loadNamespaces(["exceptions", "common"]);
    server.use(getExceptionsListMockHandler(queue([mismatch])));
    const view = renderPage();
    expect(
      await screen.findByText(/the packing list says 40, the PO says 50/),
    ).toBeVisible();
    expect(screen.getByText("-10")).toBeVisible();
    expect(screen.getByText("Support")).toBeVisible();
    expect(screen.getByText("Mock")).toBeVisible();
    expect(screen.getByRole("link", { name: "SO-0007" })).toHaveAttribute(
      "href",
      "/order-tracker/SO-0007",
    );
    expect(await axeViolations(view.container)).toEqual([]);
  });

  it("shows an empty queue with a next step", async () => {
    await i18n.loadNamespaces(["exceptions", "common"]);
    server.use(getExceptionsListMockHandler(queue([])));
    renderPage();
    expect(await screen.findByText("No exceptions")).toBeVisible();
    expect(
      screen.getByRole("link", { name: "Open the order tracker" }),
    ).toBeVisible();
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
