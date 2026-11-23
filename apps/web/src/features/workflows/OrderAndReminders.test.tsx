import { fireEvent, screen, waitFor } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import i18n from "@/i18n";
import {
  getWorkflowsConfirmPaymentMockHandler,
  getWorkflowsMyRemindersMockHandler,
  getWorkflowsMyRemindersResponseMock,
  getWorkflowsNoticesForMeMockHandler,
  getWorkflowsNoticesForMeResponseMock,
  getWorkflowsOrderFlowMockHandler,
  getWorkflowsOrderFlowResponseMock,
} from "@/lib/api/generated/endpoints/workflows/workflows.msw";
import { axeViolations } from "@/test/axe";
import { errorBody } from "@/test/fixtures";
import { useToastStore } from "@/components/common/toast";
import { server } from "@/test/server";
import OrderStepsPage from "./OrderStepsPage";
import { renderWorkflowPage } from "./render";
import RemindersPage from "./RemindersPage";

function notices(data: unknown[]) {
  return getWorkflowsNoticesForMeResponseMock({
    data: data as never,
    meta: { page: 1, pageSize: 50, total: data.length },
  });
}

const NOTICE = {
  id: "00000000-0000-4000-8000-000000000099",
  kind: "ESCALATION",
  orderNo: "SO-0005",
  taskKind: "APPROVE_SPR",
  dueAt: "2026-11-02T01:00:00.000Z",
  sentAt: "2026-11-02T05:00:00.000Z",
} as const;

// A sample's flow, so `meta.mock` is set, not left to the generated mock's coin toss.
const FLOW = getWorkflowsOrderFlowResponseMock({
  meta: { mock: true },
  data: {
    // No PI sent: set here, not left to the generated mock.
    pi: null,
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
    documents: [],
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

  it("offers the payment form only to a role that can confirm, and offers Undo once it is confirmed", async () => {
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
    await waitFor(() => {
      expect(useToastStore.getState().items.at(-1)?.kind).toBe("done");
    });
    expect(useToastStore.getState().items.at(-1)?.undo).toBeTypeOf("function");
  });

  it("puts the payment card before the steps for a role that can confirm, and after them for the rest", async () => {
    server.use(getWorkflowsOrderFlowMockHandler(FLOW));
    const finance = openOrder("FINANCE");
    const pay = await finance.findByRole("heading", { name: "Payment" });
    const steps = finance.getByRole("heading", { name: "Steps" });
    // Document order, not only looks: a keyboard reaches the card first too.
    expect(
      pay.compareDocumentPosition(steps) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    finance.unmount();
    const support = openOrder("SUPPORT");
    const payLate = await support.findByRole("heading", { name: "Payment" });
    const stepsFirst = support.getByRole("heading", { name: "Steps" });
    expect(
      stepsFirst.compareDocumentPosition(payLate) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
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
      screen.getByRole("link", { name: "Back to My tasks" }),
    ).toHaveAttribute("href", "/workflows");
  });
});

describe("reminders", () => {
  beforeEach(() => {
    server.use(getWorkflowsNoticesForMeMockHandler(notices([])));
  });

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

  it("opens the SPR a reminder is about", async () => {
    const [first] = reminders.data;
    if (!first) throw new Error("no reminder");
    server.use(
      getWorkflowsMyRemindersMockHandler({
        ...reminders,
        data: [
          {
            ...first,
            kind: "TASK_DUE",
            stage: "sent",
            orderNo: "SO-0078",
            message: "Approve or reject the SPR for SO-0078.",
            toRole: "APPROVER",
            escalatedTo: null,
            ref: { recordNo: "SPR-20261109-0003", navisionNo: null },
            spr: {
              itemNo: "I-0292",
              itemDescription: "Vertiv Rack Rail Kit",
              quantity: "90",
              monthsOfCover: "0.4",
            },
          },
        ],
      }),
    );
    renderWorkflowPage(<RemindersPage />, {
      role: "APPROVER",
      route: "/",
      path: "/",
    });
    expect(
      await screen.findByRole("link", { name: "SPR-20261109-0003" }),
    ).toHaveAttribute("href", "/workflows/sprs/SPR-20261109-0003");
    // What it would buy, as the task row says it.
    expect(screen.getByText("90 × Vertiv Rack Rail Kit")).toBeInTheDocument();
    expect(screen.getByText("Under a month of stock")).toBeInTheDocument();
    expect(
      screen.getByRole("region", { name: "Reminders for Management approver" }),
    ).toBeInTheDocument();
    // The message says it is a due task, so the kind is not repeated.
    expect(screen.queryByText("Task due")).toBeNull();
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

describe("what has been sent to you", () => {
  beforeAll(async () => {
    await i18n.loadNamespaces("workflows");
  });

  beforeEach(() => {
    server.use(
      getWorkflowsMyRemindersMockHandler(
        getWorkflowsMyRemindersResponseMock({
          data: [],
          meta: { page: 1, pageSize: 25, total: 0, mock: true },
        }),
      ),
    );
  });

  const open = () =>
    renderWorkflowPage(<RemindersPage />, {
      role: "APPROVER",
      route: "/",
      path: "/",
    });

  it("shows a sent notice with its kind and a link to the order", async () => {
    server.use(getWorkflowsNoticesForMeMockHandler(notices([NOTICE])));
    const { container } = open();
    expect(
      await screen.findByRole("region", { name: "Sent to you" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Escalation")).toBeInTheDocument();
    expect(screen.getByText(/for SO-0005 is overdue/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "SO-0005" })).toHaveAttribute(
      "href",
      "/workflows/orders/SO-0005",
    );
    expect(await axeViolations(container)).toEqual([]);
  });

  // The role's own list already shows what was sent, so this folds away below it.
  it("folds what was sent below the role's own list", async () => {
    server.use(getWorkflowsNoticesForMeMockHandler(notices([NOTICE])));
    open();
    const summary = await screen.findByText("Show the reminder sent to you");
    expect(summary.closest("details")).not.toHaveAttribute("open");
    const list = screen.getByRole("region", {
      name: "Reminders for Management approver",
    });
    const sent = screen.getByRole("region", { name: "Sent to you" });
    expect(
      list.compareDocumentPosition(sent) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("shows nothing extra when nothing has been sent", async () => {
    let answered = false;
    server.use(
      http.get("*/api/v1/workflows/reminders/for-me", () => {
        answered = true;
        return HttpResponse.json(notices([]));
      }),
    );
    open();
    expect(await screen.findByText("No reminders")).toBeInTheDocument();
    await waitFor(() => {
      expect(answered).toBe(true);
    });
    expect(screen.queryByText("Sent to you")).not.toBeInTheDocument();
  });

  it("says so when they cannot be loaded, because one may be waiting", async () => {
    server.use(
      http.get("*/api/v1/workflows/reminders/for-me", () =>
        HttpResponse.json(errorBody("INTERNAL_ERROR", "trace-notices-1"), {
          status: 500,
        }),
      ),
    );
    open();
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "trace-notices-1",
    );
  });
});
