import { fireEvent, screen, within } from "@testing-library/react";
import { beforeAll, describe, expect, it } from "vitest";
import i18n from "@/i18n";
import {
  getWorkflowsApproveMockHandler,
  getWorkflowsSprMockHandler,
  getWorkflowsSprResponseMock,
} from "@/lib/api/generated/endpoints/workflows/workflows.msw";
import { axeViolations } from "@/test/axe";
import { server } from "@/test/server";
import { renderWorkflowPage } from "./render";
import SprApprovalPage from "./SprApprovalPage";

function spr(decision: null | { outcome: "approved"; by: string }) {
  const base = getWorkflowsSprResponseMock();
  return {
    ...base,
    data: {
      ...base.data,
      ref: { recordNo: "SPR-20261102-0001", navisionNo: null },
      orderNo: "SO-0003",
      requestedBy: { name: "Prakash Menon", role: "PRODUCT_MANAGER" as const },
      requestedAt: "2026-11-02T02:00:00Z",
      vendor: { no: "V-0001", name: "Halvorn Components Ltd" },
      item: { no: "I-0008", description: "Kelmora Power Bank 10000 mAh" },
      quantity: "98.00",
      unitCost: "16.52",
      amount: "1618.96",
      currencyCode: "USD",
      basis: {
        ordered: "120",
        inventory: "20",
        qtyOnSalesOrder: "20",
        qtyOnPurchOrder: "22",
        availableStock: "22.00",
        shortfall: "98.00",
      },
      fields: [
        {
          key: "quantity",
          label: "Quantity",
          value: "98.00",
          origin: "suggested" as const,
          required: true,
        },
        {
          key: "deliveryTerms",
          label: "Delivery terms",
          value: "FOB",
          origin: "default" as const,
          required: false,
        },
      ],
      approver: {
        displayName: "Anita Rao",
        setup: {
          userId: "00000000-0000-4000-8000-000000000385",
          approverId: "00000000-0000-4000-8000-000000000386",
          salesAmountApprovalLimit: "20000.00",
          purchaseAmountApprovalLimit: "5000.00",
          unlimitedSalesApproval: false,
          unlimitedPurchaseApproval: false,
          substituteUserId: "00000000-0000-4000-8000-000000000387",
        },
      },
      substituteName: "Prakash Menon",
      decision: decision
        ? {
            ...decision,
            comment: "Within my limit.",
            at: "2026-11-02T05:00:00Z",
          }
        : null,
    },
  };
}

function open(role: "APPROVER" | "PRODUCT_MANAGER") {
  return renderWorkflowPage(<SprApprovalPage />, {
    role,
    route: "/sprs/SPR-20261102-0001",
    path: "/sprs/:recordNo",
  });
}

describe("the SPR approval page", () => {
  beforeAll(async () => {
    await i18n.loadNamespaces("workflows");
  });

  it("marks the suggested fields and shows both numbers, the stock basis and the approver", async () => {
    server.use(getWorkflowsSprMockHandler(spr(null)));
    const { container } = open("APPROVER");
    expect(
      await screen.findByText("Kelmora Power Bank 10000 mAh (I-0008)"),
    ).toBeInTheDocument();
    expect(
      within(screen.getByRole("row", { name: /Quantity/ })).getByText(
        "Suggested",
      ),
    ).toBeInTheDocument();
    expect(
      within(screen.getByRole("row", { name: /Delivery terms/ })).getByText(
        "Default",
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("SPR-20261102-0001")).toBeInTheDocument();
    expect(screen.getByText(/none yet/)).toBeInTheDocument();
    expect(
      screen.getByText("Shortfall (suggested quantity)"),
    ).toBeInTheDocument();
    expect(screen.getByText("Limited: 5,000.00 USD")).toBeInTheDocument();
    expect(await axeViolations(container)).toEqual([]);
  });

  it("has one primary button, asks for a comment, and says nothing was changed", async () => {
    server.use(
      getWorkflowsSprMockHandler(spr(null)),
      getWorkflowsApproveMockHandler(),
    );
    open("APPROVER");
    await screen.findByText("Your decision");
    fireEvent.click(screen.getByRole("button", { name: "Approve" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Write a comment",
    );
    fireEvent.change(screen.getByLabelText("Comment"), {
      target: { value: "Checked against the quote." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Approve" }));
    expect(await screen.findByRole("status")).toHaveTextContent(
      "Approved was checked",
    );
    const primary = screen
      .getAllByRole("button")
      .filter((button) => button.className.includes("bg-primary"));
    expect(primary).toHaveLength(1);
  });

  it("is read-only for a role that cannot decide", async () => {
    server.use(getWorkflowsSprMockHandler(spr(null)));
    open("PRODUCT_MANAGER");
    expect(
      await screen.findByText(
        "Your role can read this request but not decide it.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Approve" }),
    ).not.toBeInTheDocument();
  });

  it("shows a decision that was already made, with its comment", async () => {
    server.use(
      getWorkflowsSprMockHandler(spr({ outcome: "approved", by: "Anita Rao" })),
    );
    open("APPROVER");
    expect(
      await screen.findByText(/Decided: Approved by Anita Rao/),
    ).toBeInTheDocument();
    expect(screen.getByText("Within my limit.")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Reject" }),
    ).not.toBeInTheDocument();
  });
});
