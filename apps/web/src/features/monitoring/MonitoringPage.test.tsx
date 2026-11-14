import { QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import i18n from "i18next";
import { HttpResponse, http } from "msw";
import { MemoryRouter } from "react-router";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  getAiUsageReportMockHandler,
  getOverviewClickstreamMockHandler,
  getOverviewObservabilityMockHandler,
} from "@/lib/api/generated/endpoints/monitoring/monitoring.msw";
import { createQueryClient } from "@/lib/query";
import { axeViolations } from "@/test/axe";
import { errorBody, sessionFor } from "@/test/fixtures";
import { server } from "@/test/server";
import { useSessionStore } from "@/stores/session";
import MonitoringPage from "./MonitoringPage";

const record = {
  id: "7d1c3a0e-2f43-4c8e-9b75-0a1d9c4b5e11",
  occurredAt: "2026-11-01T09:30:00Z",
  feature: "extraction",
  provider: "mock",
  model: "mock-small",
  promptVersion: "v1",
  inputTokens: 1200,
  outputTokens: 340,
  costUsd: "0.0210",
  latencyMs: 820,
  status: "ok" as const,
  userId: null,
  traceId: "trace-ai-1",
};

const usage = (calls: number) => ({
  data: {
    summary: {
      calls,
      inputTokens: calls * 1200,
      outputTokens: calls * 340,
      costUsd: "0.0210",
      failedCalls: 0,
    },
    byFeature:
      calls === 0 ? [] : [{ feature: "extraction", calls, costUsd: "0.0210" }],
    records: calls === 0 ? [] : [record],
  },
  meta: { page: 1, pageSize: 10, total: calls },
});

function renderPage() {
  return render(
    <QueryClientProvider client={createQueryClient()}>
      <MemoryRouter>
        <MonitoringPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("MonitoringPage", () => {
  beforeAll(async () => {
    await i18n.loadNamespaces("monitoring");
  });
  beforeEach(() => {
    useSessionStore.getState().setSession(sessionFor("SYSTEM_ADMIN"));
  });

  it("shows real AI usage and cost with no axe violations", async () => {
    server.use(getAiUsageReportMockHandler(usage(1)));
    const { container } = renderPage();
    const table = await screen.findByRole("table", { name: "Latest AI calls" });
    expect(within(table).getByText("mock / mock-small")).toBeVisible();
    expect(within(table).getByText("trace-ai-1")).toBeVisible();
    expect(await axeViolations(container)).toEqual([]);
  });

  it("says plainly that nothing has called a model yet", async () => {
    server.use(getAiUsageReportMockHandler(usage(0)));
    renderPage();
    expect(await screen.findByText("No AI calls recorded yet")).toBeVisible();
    expect(
      screen.getByRole("link", { name: "See what data may go to AI" }),
    ).toBeVisible();
  });

  it("shows the trace id and a retry when the usage call fails", async () => {
    server.use(
      http.get("*/api/v1/monitoring/ai-usage", () =>
        HttpResponse.json(errorBody("INTERNAL_ERROR", "trace-fail-9"), {
          status: 500,
        }),
      ),
    );
    renderPage();
    expect(await screen.findByText(/trace-fail-9/)).toBeVisible();
    expect(
      screen.getByRole("button", { name: /retry|try again/i }),
    ).toBeVisible();
  });

  it("labels observability as mock data and flags a degraded service", async () => {
    server.use(
      getAiUsageReportMockHandler(usage(1)),
      getOverviewObservabilityMockHandler({
        data: {
          services: [
            {
              name: "orderpilot-api",
              status: "degraded",
              p95Ms: 420,
              errorRate: "2.5",
              requestsPerMinute: 31,
            },
          ],
          recentTraces: [
            {
              traceId: "abc123",
              route: "/api/v1/orders/:id",
              durationMs: 88,
              status: 200,
            },
          ],
        },
        meta: { mock: true },
      }),
    );
    renderPage();
    await userEvent.click(
      await screen.findByRole("tab", { name: "Observability" }),
    );
    expect(await screen.findByText("Mock")).toBeVisible();
    expect(screen.getByRole("status")).toHaveTextContent(
      "orderpilot-api is degraded",
    );
    expect(screen.getByText("/api/v1/orders/:id")).toBeVisible();
  });

  it("labels the clickstream summary as mock data and shows this browser's choice", async () => {
    server.use(
      getAiUsageReportMockHandler(usage(1)),
      getOverviewClickstreamMockHandler({
        data: {
          consentRate: "62.5",
          topRoutes: [{ route: "/orders/:id", views: 14 }],
          byRole: [{ role: "SALES", events: 9 }],
        },
        meta: { mock: true },
      }),
    );
    renderPage();
    await userEvent.click(
      await screen.findByRole("tab", { name: "Clickstream" }),
    );
    expect(await screen.findByText("62.5% allowed")).toBeVisible();
    expect(screen.getByText("/orders/:id")).toBeVisible();
    expect(screen.getByText("Mock")).toBeVisible();
  });

  it.todo("shows the permission-denied state when the role cannot read usage");
  it.todo(
    "reads the real ClickstreamEvent table once Angelyn builds the summary",
  );
  it.todo("charts cost per day and flags a budget breach");
  it.todo("lists alerts and their acknowledgements");
});
