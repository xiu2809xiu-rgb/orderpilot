import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { describe, expect, it } from "vitest";
import i18n from "@/i18n";
import { getInsightsKpisMockHandler } from "@/lib/api/generated/endpoints/insights/insights.msw";
import type { InsightsKpis200 } from "@/lib/api/generated/model";
import { axeViolations } from "@/test/axe";
import { errorBody } from "@/test/fixtures";
import { server } from "@/test/server";
import InsightsPage from "./InsightsPage";

const ids = [
  ["processingTime", "Order-processing time", "minutes per order"],
  ["manualTouches", "Manual touches per order", "touches"],
  ["dataEntryErrors", "Data-entry errors", "per 100 fields"],
  ["approvalTurnaround", "Approval turnaround", "hours"],
  ["overdueOrders", "Overdue orders", "orders"],
] as const;

const kpis = (count = 5) =>
  ({
    data: {
      labEstimate: true,
      note: "Mock lab estimates on synthetic data.",
      measures: ids.slice(0, count).map(([id, label, unit], index) => ({
        id,
        label,
        unit,
        manual: 40 - index,
        withOrderPilot: 10 + index,
        lowerIsBetter: true,
        definition: `How ${label} is worded.`,
      })),
    },
    meta: { mock: true },
  }) as InsightsKpis200;

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <InsightsPage />
    </QueryClientProvider>,
  );
}

describe("the KPI dashboard", () => {
  it("shows the five measures labelled as mock lab estimates, and lazy-loads the charts", async () => {
    await i18n.loadNamespaces(["insights", "common"]);
    server.use(getInsightsKpisMockHandler(kpis()));
    const view = renderPage();
    for (const [, label] of ids) {
      expect(await screen.findByRole("heading", { name: label })).toBeVisible();
    }
    expect(screen.getByText("Mock lab estimates")).toBeVisible();
    expect(screen.getByText("Mock")).toBeVisible();
    expect(
      await screen.findAllByRole("img", {
        name: /by hand, .* with OrderPilot/,
      }),
    ).toHaveLength(5);
    expect(await axeViolations(view.container)).toEqual([]);
  });

  it("offers the same figures as a table", async () => {
    await i18n.loadNamespaces(["insights", "common"]);
    server.use(getInsightsKpisMockHandler(kpis()));
    renderPage();
    await userEvent.click(
      await screen.findByRole("button", { name: "Show as a table" }),
    );
    const table = screen.getByRole("table", { name: "The five measures" });
    expect(within(table).getAllByRole("row")).toHaveLength(6);
  });

  it("shows an empty state when there are no measures", async () => {
    await i18n.loadNamespaces(["insights", "common"]);
    server.use(getInsightsKpisMockHandler(kpis(0)));
    renderPage();
    expect(await screen.findByText("No measures yet")).toBeVisible();
  });

  it("shows the error with its trace id", async () => {
    await i18n.loadNamespaces(["insights", "common"]);
    server.use(
      http.get("*/api/v1/insights/kpis", () =>
        HttpResponse.json(errorBody("INTERNAL_ERROR", "trace-kpi-1"), {
          status: 500,
        }),
      ),
    );
    renderPage();
    const alert = await screen.findByRole("alert");
    expect(within(alert).getByText("trace-kpi-1")).toBeInTheDocument();
  });

  it("shows permission denied when the API refuses the role", async () => {
    await i18n.loadNamespaces(["insights", "common"]);
    server.use(
      http.get("*/api/v1/insights/kpis", () =>
        HttpResponse.json(errorBody("FORBIDDEN"), { status: 403 }),
      ),
    );
    renderPage();
    expect(
      await screen.findByText("You do not have access to this"),
    ).toBeVisible();
  });
});
