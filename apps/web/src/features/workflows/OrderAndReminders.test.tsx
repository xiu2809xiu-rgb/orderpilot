import { fireEvent, screen } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { beforeAll, describe, expect, it } from "vitest";
import i18n from "@/i18n";
import {
  getWorkflowsConfirmPaymentMockHandler,
  getWorkflowsMyRemindersMockHandler,
  getWorkflowsMyRemindersResponseMock,
  getWorkflowsOrderFlowMockHandler,
  getWorkflowsOrderFlowResponseMock,
} from "@/lib/api/generated/endpoints/workflows/workflows.msw";
import { axeViolations } from "@/test/axe";
import { errorBody } from "@/test/fixtures";
import { server } from "@/test/server";
import OrderStepsPage from "./OrderStepsPage";
import { renderWorkflowPage } from "./render";
import RemindersPage from "./RemindersPage";

const FLOW = getWorkflowsOrderFlowResponseMock({
  data: {
    order: {
      no: "SO-0004",
      sellToCustomerNo: "C-0004",
      customerName: "Quillon Harbour Traders",
      externalDocumentNo: "PO-PK-4121",
      orderDate: "2026-10-29",
    },
    steps: [
      {
        key: "po-received",
        ownerRole: "SUPPORT",
        state: "done",
        optional: false,
        dueAt: "2026-10-29T09:00:00Z",
        completedAt: "2026-10-29T08:00:00Z",
        overdue: false,
      },
      {
        key: "payment-confirmed",
        ownerRole: "FINANCE",
        state: "current",
        optional: false,
        dueAt: "2026-11-06T09:00:00Z",
        completedAt: null,
        overdue: false,
      },
    ],
    timeline: [
      {
        id: "00000000-0000-4000-8000-0000000000a1",
        at: "2026-10-29T01:00:00Z",
        kind: "order.received",
        actor: { kind: "system", name: "OrderPilot" },
        summary: "PO PO-PK-4121 received for SO-0004",
      },
    ],
    payment: {
      prepaymentPercent: "50",
      amountDue: "2500.00",
      confirmations: [],
    },
  },
});

function openOrder(role: "FINANCE" | "SUPPORT") {
  return renderWorkflowPage(<OrderStepsPage />, {
    role,
    route: "/orders/SO-0004",
    path: "/orders/:orderNo",
  });
}

describe("an order's steps and timeline", () => {
  beforeAll(async () => {
    await i18n.loadNamespaces("workflows");
  });

  it("shows the steps, the current one marked, the timeline and the payment", async () => {
    server.use(getWorkflowsOrderFlowMockHandler(FLOW));
    const { container } = openOrder("SUPPORT");
    expect(await screen.findByText("Payment confirmed")).toBeInTheDocument();
    expect(screen.getByText("Waiting here")).toBeInTheDocument();
    expect(
      screen.getByText("PO PO-PK-4121 received for SO-0004"),
    ).toBeInTheDocument();
    expect(screen.getByText("50%")).toBeInTheDocument();
    expect(screen.getByText("2,500.00 USD")).toBeInTheDocument();
    expect(screen.getByText("Mock")).toBeInTheDocument();
    expect(await axeViolations(container)).toEqual([]);
  });

  it("offers the payment form only to a role that can confirm, and says nothing was saved", async () => {
    server.use(
      getWorkflowsOrderFlowMockHandler(FLOW),
      getWorkflowsConfirmPaymentMockHandler(),
    );
    openOrder("FINANCE");
    await screen.findByText("Confirm a payment");
    fireEvent.click(screen.getByRole("button", { name: "Confirm payment" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Fill in every");
    fireEvent.change(screen.getByLabelText("Amount (USD)"), {
      target: { value: "1250.00" },
    });
    fireEvent.change(screen.getByLabelText("Bank reference"), {
      target: { value: "TT-1" },
    });
    fireEvent.change(screen.getByLabelText("Paid on"), {
      target: { value: "2026-11-02" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Confirm payment" }));
    expect(await screen.findByRole("status")).toBeInTheDocument();
  });

  it("hides the payment form from a role that cannot confirm", async () => {
    server.use(getWorkflowsOrderFlowMockHandler(FLOW));
    openOrder("SUPPORT");
    await screen.findByText("Payment confirmed");
    expect(screen.queryByText("Confirm a payment")).not.toBeInTheDocument();
  });

  it("says when the order is not in the sample data", async () => {
    server.use(
      http.get("*/api/v1/workflows/orders/:orderNo/flow", () =>
        HttpResponse.json(errorBody("NOT_FOUND"), { status: 404 }),
      ),
    );
    openOrder("SUPPORT");
    expect(
      await screen.findByText("This order is not in the sample data"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Back to the task inbox" }),
    ).toHaveAttribute("href", "/workflows");
  });
});

describe("reminders", () => {
  beforeAll(async () => {
    await i18n.loadNamespaces("workflows");
  });

  const reminders = getWorkflowsMyRemindersResponseMock({
    data: [
      {
        id: "00000000-0000-4000-8000-0000000000b1",
        kind: "SHIPPING_DOCUMENT_MISSING",
        stage: "escalated",
        orderNo: "SO-0008",
        message: "The air waybill for SO-0008 is still missing.",
        toRole: "LOGISTICS",
        dueAt: "2026-10-30T09:00:00Z",
        remindAt: "2026-10-31T01:00:00Z",
        escalatesAt: null,
        escalatedTo: "MANAGEMENT",
      },
    ],
    meta: {
      page: 1,
      pageSize: 25,
      total: 1,
      mock: true,
    },
  });

  it("shows what is due, its stage and where it was passed up to", async () => {
    server.use(getWorkflowsMyRemindersMockHandler(reminders));
    const { container } = renderWorkflowPage(<RemindersPage />, {
      role: "LOGISTICS",
      route: "/",
      path: "/",
    });
    expect(
      await screen.findByText("The air waybill for SO-0008 is still missing."),
    ).toBeInTheDocument();
    expect(screen.getByText("Escalated")).toBeInTheDocument();
    expect(screen.getByText("Passed up to Management")).toBeInTheDocument();
    expect(await axeViolations(container)).toEqual([]);
  });

  it("has an empty state", async () => {
    server.use(
      getWorkflowsMyRemindersMockHandler(
        getWorkflowsMyRemindersResponseMock({
          data: [],
          meta: {
            page: 1,
            pageSize: 25,
            total: 0,
            mock: true,
          },
        }),
      ),
    );
    renderWorkflowPage(<RemindersPage />, {
      role: "LOGISTICS",
      route: "/",
      path: "/",
    });
    expect(await screen.findByText("No reminders")).toBeInTheDocument();
  });
});
