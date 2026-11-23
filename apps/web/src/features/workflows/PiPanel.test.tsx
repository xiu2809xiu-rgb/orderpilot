import { fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeAll, describe, expect, it } from "vitest";
import i18n from "@/i18n";
import { useToastStore } from "@/components/common/toast";
import {
  getWorkflowsOrderFlowMockHandler,
  getWorkflowsOrderFlowResponseMock,
  getWorkflowsReissuePiMockHandler,
} from "@/lib/api/generated/endpoints/workflows/workflows.msw";
import { axeViolations } from "@/test/axe";
import { server } from "@/test/server";
import OrderStepsPage from "./OrderStepsPage";
import { renderWorkflowPage } from "./render";

const PI = {
  recordNo: "PI-20261119-0002",
  issue: 2,
  sentAt: "2026-11-20T03:00:00Z",
  sentBy: "Mei Lin Tan",
  reversals: [
    {
      issue: 1,
      reason: "Wrong shipping terms",
      at: "2026-11-20T03:00:00Z",
      by: "Mei Lin Tan",
    },
  ],
  reissuable: true,
};

/** An order the state machine runs, with its PI sent and reissued once. */
function flow(pi: typeof PI | null) {
  return getWorkflowsOrderFlowResponseMock({
    meta: { mock: false },
    data: {
      order: {
        no: "SO-0069",
        sellToCustomerNo: "C-0069",
        customerName: "Quillon Harbour Traders",
        externalDocumentNo: "PO-PK-4170",
        orderDate: "2026-11-18",
      },
      steps: [
        {
          key: "packed",
          ownerRole: "WAREHOUSE",
          state: "current",
          optional: false,
          dueAt: "2026-11-25T09:00:00Z",
          completedAt: null,
          overdue: false,
        },
      ],
      timeline: [],
      documents: [],
      payment: { prepaymentPercent: "0", amountDue: null, confirmations: [] },
      pi,
    },
  });
}

function openOrder(role: "SUPPORT" | "FINANCE") {
  return renderWorkflowPage(<OrderStepsPage />, {
    role,
    route: "/workflows/orders/SO-0069",
    path: "/workflows/orders/:orderNo",
  });
}

describe("the PI on an order's steps page (#251, point 6)", () => {
  beforeAll(async () => {
    await i18n.loadNamespaces("workflows");
  });

  it("shows the PI's issue and every reversal with its reason", async () => {
    server.use(getWorkflowsOrderFlowMockHandler(flow(PI)));
    const { container } = openOrder("SUPPORT");

    expect(await screen.findByText("Pro forma invoice")).toBeInTheDocument();
    expect(screen.getByText("PI-20261119-0002")).toBeInTheDocument();
    expect(screen.getByText(/issue 2/)).toBeInTheDocument();
    expect(
      screen.getByText(/Issue 1 reversed by Mei Lin Tan/),
    ).toBeInTheDocument();
    expect(screen.getByText("Wrong shipping terms")).toBeInTheDocument();
    expect(await axeViolations(container)).toEqual([]);
  });

  it("asks why before reversing, then reissues it", async () => {
    let sent: unknown = null;
    server.use(
      getWorkflowsOrderFlowMockHandler(flow(PI)),
      getWorkflowsReissuePiMockHandler(async ({ request }) => {
        sent = await request.json();
        return {
          data: {
            applied: true,
            message: "Reversed and reissued.",
            orderNo: "SO-0069",
            recordNo: "PI-20261119-0002",
            issue: 3,
          },
        };
      }),
    );
    openOrder("SUPPORT");

    fireEvent.click(
      await screen.findByRole("button", { name: "Reverse and reissue" }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Reverse and send issue 3" }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent("Say why");
    expect(sent).toBeNull();

    fireEvent.change(screen.getByLabelText("Why it is reversed"), {
      target: { value: "Customer's PO number missing" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Reverse and send issue 3" }),
    );

    await waitFor(() => {
      expect(useToastStore.getState().items.at(-1)?.message).toBe(
        "PI-20261119-0002 reissued as issue 3",
      );
    });
    expect(sent).toEqual({ reason: "Customer's PO number missing" });
  });

  it("offers no reissue to a role that cannot edit orders", async () => {
    server.use(getWorkflowsOrderFlowMockHandler(flow(PI)));
    openOrder("FINANCE");
    expect(await screen.findByText("PI-20261119-0002")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Reverse and reissue" }),
    ).toBeNull();
  });

  it("says why it cannot be reissued once a payment or the packing has followed", async () => {
    server.use(
      getWorkflowsOrderFlowMockHandler(flow({ ...PI, reissuable: false })),
    );
    openOrder("SUPPORT");
    expect(
      await screen.findByText(/a payment or the packing has followed/i),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Reverse and reissue" }),
    ).toBeNull();
  });

  it("shows no PI card before the PI is sent", async () => {
    server.use(getWorkflowsOrderFlowMockHandler(flow(null)));
    openOrder("SUPPORT");
    expect(
      await screen.findByText("Quillon Harbour Traders", { exact: false }),
    ).toBeInTheDocument();
    expect(screen.queryByText("Pro forma invoice")).toBeNull();
  });
});
