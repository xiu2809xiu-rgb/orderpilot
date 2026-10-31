import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { MemoryRouter, Route, Routes } from "react-router";
import { describe, expect, it } from "vitest";
import i18n from "@/i18n";
import { getTrackerTimelineMockHandler } from "@/lib/api/generated/endpoints/tracker/tracker.msw";
import type { TrackerTimeline200 } from "@/lib/api/generated/model";
import { axeViolations } from "@/test/axe";
import { errorBody } from "@/test/fixtures";
import { server } from "@/test/server";
import OrderDetailPage from "./OrderDetailPage";

const timeline = {
  data: {
    orderNo: "SO-0007",
    externalDocumentNo: "PO-7",
    customerNo: "C0007",
    customerName: "Harbour Marine Supply",
    status: { code: "sample", label: "Packing list differs from the PO" },
    ownerRole: "SUPPORT",
    overdue: { overdue: false, daysOverdue: 0, reason: null },
    steps: [
      {
        id: "s1",
        at: "2026-10-01T08:00:00.000Z",
        actor: "Finance",
        title: "Payment confirmed",
        effect: "Payment confirmed: packing released",
        current: false,
      },
      {
        id: "s2",
        at: "2026-10-02T09:00:00.000Z",
        actor: "System",
        title: "Packing list checked against the PO",
        effect: "A quantity differs",
        current: true,
      },
    ],
    checks: [
      {
        id: "c1",
        ruleId: "mock.sample-quantity",
        ruleLabel: "Packing list quantity against the PO (sample result)",
        orderNo: "SO-0007",
        outcome: "fail",
        expected: "50",
        actual: "40",
        tolerance: { label: "Quantity difference (sample value)", value: "0" },
        evidence: [
          {
            documentId: "d1",
            documentType: "PACKING_LIST",
            location: "item 1000: quantity",
            value: "40",
          },
        ],
        checkedAt: "2026-10-02T09:00:00.000Z",
      },
    ],
    matches: [
      {
        kind: "customer",
        printedNo: "C0007",
        printedName: "HARBOUR MARINE SUPPLY",
        matchedNo: "C0007",
        matchedName: "Harbour Marine Supply",
        possibleMatches: [{ no: "C0012", name: "Harbour Marine Supplies" }],
      },
    ],
  },
  meta: { mock: true },
} as TrackerTimeline200;

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={["/order-tracker/SO-0007"]}>
        <Routes>
          <Route path="/order-tracker/:orderNo" element={<OrderDetailPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("an order's detail page", () => {
  it("shows each step with its effect, the checks, the matches and the operation log", async () => {
    await i18n.loadNamespaces(["order-tracker", "common"]);
    server.use(getTrackerTimelineMockHandler(timeline));
    const view = renderPage();
    expect(
      await screen.findByText("Payment confirmed: packing released"),
    ).toBeInTheDocument();
    expect(screen.getByText("Current step")).toBeInTheDocument();
    expect(screen.getByText("Fail")).toBeInTheDocument();
    expect(screen.getByText(/item 1000: quantity/)).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Operation log" })).toBeVisible();
    expect(await axeViolations(view.container)).toEqual([]);
  });

  it("matches on the number and lists a look-alike name only as a possible match", async () => {
    await i18n.loadNamespaces(["order-tracker", "common"]);
    server.use(getTrackerTimelineMockHandler(timeline));
    renderPage();
    const matches = await screen.findByRole("region", {
      name: /matched on Navision numbers/i,
    });
    const row = within(matches).getAllByRole("row")[1];
    if (!row) throw new Error("No match row");
    const cells = within(row).getAllByRole("cell");
    expect(cells[2]).toHaveTextContent("C0007");
    expect(cells[3]).toHaveTextContent("C0012");
    expect(cells[3]).toHaveTextContent("Harbour Marine Supplies");
  });

  it("says nothing about posting money here", async () => {
    await i18n.loadNamespaces(["order-tracker", "common"]);
    server.use(getTrackerTimelineMockHandler(timeline));
    renderPage();
    expect(
      await screen.findByText(/Postings to the ledger are made in Navision/),
    ).toBeVisible();
  });

  it("shows not found for an unknown order, with a way back", async () => {
    await i18n.loadNamespaces(["order-tracker", "common"]);
    server.use(
      http.get("*/api/v1/tracker/orders/:orderNo", () =>
        HttpResponse.json(errorBody("NOT_FOUND", "trace-nf-1"), {
          status: 404,
        }),
      ),
    );
    renderPage();
    expect(
      await screen.findByText("That order is not in the tracker"),
    ).toBeVisible();
    expect(
      screen.getByRole("link", { name: "Back to the tracker" }),
    ).toBeVisible();
  });

  it("shows the error with its trace id and retry", async () => {
    await i18n.loadNamespaces(["order-tracker", "common"]);
    server.use(
      http.get("*/api/v1/tracker/orders/:orderNo", () =>
        HttpResponse.json(errorBody("INTERNAL_ERROR", "trace-detail-1"), {
          status: 500,
        }),
      ),
    );
    renderPage();
    const alert = await screen.findByRole("alert");
    expect(within(alert).getByText("trace-detail-1")).toBeInTheDocument();
  });
});
