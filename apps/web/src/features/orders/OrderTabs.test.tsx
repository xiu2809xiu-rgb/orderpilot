import { QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import i18n from "i18next";
import { HttpResponse, http } from "msw";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  getWorkflowsOrderFlowMockHandler,
  getWorkflowsOrderFlowResponseMock,
} from "@/lib/api/generated/endpoints/workflows/workflows.msw";
import { createQueryClient } from "@/lib/query";
import { useSessionStore } from "@/stores/session";
import { errorBody, sessionFor } from "@/test/fixtures";
import { server } from "@/test/server";
import { OrderDocumentsTab, OrderTimelineTab } from "./OrderTabs";

const FLOW = getWorkflowsOrderFlowResponseMock({
  data: {
    ...getWorkflowsOrderFlowResponseMock().data,
    timeline: [
      {
        id: "00000000-0000-4000-8000-000000000001",
        at: "2026-11-08T02:00:00.000Z",
        kind: "order.received",
        actor: { kind: "system", name: "OrderPilot" },
        summary: "Customer PO received by email",
      },
    ],
    documents: [
      {
        id: "doc-1",
        type: "CUSTOMER_PO",
        number: "PO-LK-4674",
        status: "confirmed",
        receivedAt: "2026-11-08T02:00:00.000Z",
        dueDate: null,
      },
      {
        id: "doc-2",
        type: "PROFORMA_INVOICE",
        number: null,
        status: "expected",
        receivedAt: null,
        dueDate: "2026-11-19",
      },
    ],
  },
});

function renderTab(tab: React.ReactNode) {
  return render(
    <QueryClientProvider client={createQueryClient()}>
      {tab}
    </QueryClientProvider>,
  );
}

describe("the order page's tabs", () => {
  beforeAll(async () => {
    await i18n.loadNamespaces(["orders", "workflows", "components", "common"]);
  });
  beforeEach(() => {
    useSessionStore.getState().setSession(sessionFor("PRODUCT_MANAGER"));
  });

  it("shows what happened to a sample order on its timeline", async () => {
    server.use(getWorkflowsOrderFlowMockHandler(FLOW));
    renderTab(<OrderTimelineTab orderNo="SO-0083" />);
    expect(
      await screen.findByText("Customer PO received by email"),
    ).toBeVisible();
  });

  it("lists the documents that came in, and the ones still expected", async () => {
    server.use(getWorkflowsOrderFlowMockHandler(FLOW));
    renderTab(<OrderDocumentsTab orderNo="SO-0083" />);
    expect(await screen.findByText("Customer PO")).toBeVisible();
    expect(screen.getByText("PO-LK-4674")).toBeVisible();
    expect(screen.getByText("Confirmed")).toBeVisible();
    expect(screen.getByText("Proforma invoice")).toBeVisible();
    expect(screen.getByText("Due 19 Nov 2026")).toBeVisible();
    expect(screen.getByText("Expected")).toBeVisible();
  });

  it("is quietly empty for an order the workflow does not know, not an error", async () => {
    server.use(
      http.get("*/api/v1/workflows/orders/:orderNo/flow", () =>
        HttpResponse.json(errorBody("NOT_FOUND"), { status: 404 }),
      ),
    );
    renderTab(<OrderDocumentsTab orderNo="SO-9999" />);
    expect(await screen.findByText("Nothing here yet.")).toBeVisible();
    expect(screen.queryByRole("alert")).toBeNull();
  });
});
