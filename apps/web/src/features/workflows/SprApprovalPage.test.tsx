import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { beforeAll, describe, expect, it } from "vitest";
import i18n from "@/i18n";
import {
  getWorkflowsApproveMockHandler,
  getWorkflowsSprMockHandler,
  getWorkflowsSprResponseMock,
} from "@/lib/api/generated/endpoints/workflows/workflows.msw";
import { axeViolations } from "@/test/axe";
import { useToastStore } from "@/components/common/toast";
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
      escalatesToName: "Sophia Chen",
      passedTo: null,
      decidable: true,
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
    // A person, by name: the setup's raw approver id means nothing to staff.
    expect(screen.getByText("Sophia Chen")).toBeInTheDocument();
    expect(screen.queryByText(/00000000-0000/)).toBeNull();
    expect(await axeViolations(container)).toEqual([]);
  });

  it("has one primary button, asks for a comment, and offers Undo once it is done", async () => {
    server.use(
      getWorkflowsSprMockHandler(spr(null)),
      getWorkflowsApproveMockHandler({
        data: {
          applied: true,
          message: "Recorded. The order has moved on.",
          recordNo: "SPR-20261102-0001",
          outcome: "approved",
          comment: "Checked against the quote.",
        },
      }),
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
    await waitFor(() => {
      expect(useToastStore.getState().items.at(-1)?.kind).toBe("done");
    });
    expect(useToastStore.getState().items.at(-1)?.undo).toBeTypeOf("function");
    const primary = screen
      .getAllByRole("button")
      .filter((button) => button.className.includes("bg-primary"));
    expect(primary).toHaveLength(1);
  });

  it("says who an SPR above the limit went to, and offers no Undo, because nothing was decided", async () => {
    server.use(
      getWorkflowsSprMockHandler(spr(null)),
      getWorkflowsApproveMockHandler({
        data: {
          applied: true,
          message: "This is above your approval limit.",
          recordNo: "SPR-20261102-0001",
          outcome: "approved",
          comment: "Checked against the quote.",
          passedToName: "Sophia Chen",
        },
      }),
    );
    open("APPROVER");
    await screen.findByText("Your decision");
    fireEvent.change(screen.getByLabelText("Comment"), {
      target: { value: "Checked against the quote." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Approve" }));
    await waitFor(() => {
      expect(useToastStore.getState().items.at(-1)?.message).toContain(
        "Sophia Chen",
      );
    });
    expect(useToastStore.getState().items.at(-1)?.undo).toBeUndefined();
  });

  it("shows that an SPR was passed on, in place of the form", async () => {
    server.use(
      getWorkflowsSprMockHandler({
        ...spr(null),
        data: {
          ...spr(null).data,
          passedTo: {
            name: "Sophia Chen",
            byName: "Anita Rao",
            at: "2026-11-02T05:00:00Z",
            askedOutcome: "rejected",
            comment: "Too dear for this quarter.",
            youDecide: false,
          },
        },
      }),
    );
    open("APPROVER");
    expect(
      await screen.findByText(/passed this on to Sophia Chen/),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Approve" }),
    ).not.toBeInTheDocument();
  });

  it("gives the person it was passed to the form, and says who sent it", async () => {
    server.use(
      getWorkflowsSprMockHandler({
        ...spr(null),
        data: {
          ...spr(null).data,
          passedTo: {
            name: "Sophia Chen",
            byName: "Anita Rao",
            at: "2026-11-02T05:00:00Z",
            askedOutcome: "rejected",
            comment: "Too dear for this quarter.",
            youDecide: true,
          },
        },
      }),
    );
    open("APPROVER");
    expect(
      await screen.findByText(/Anita Rao passed this on to you/),
    ).toBeInTheDocument();
    expect(screen.getByText("Too dear for this quarter.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Approve" })).toBeInTheDocument();
  });

  it("tells the person it waits for even when their role cannot decide yet", async () => {
    server.use(
      getWorkflowsSprMockHandler({
        ...spr(null),
        data: {
          ...spr(null).data,
          passedTo: {
            name: "Sophia Chen",
            byName: "Anita Rao",
            at: "2026-11-02T05:00:00Z",
            askedOutcome: "approved",
            comment: "Over my limit.",
            youDecide: true,
          },
        },
      }),
    );
    open("PRODUCT_MANAGER");
    expect(
      await screen.findByText(/Anita Rao passed this on to you/),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Your role can read this request but not decide it."),
    ).toBeInTheDocument();
  });

  it("offers no form on a sample the workflow does not run", async () => {
    server.use(
      getWorkflowsSprMockHandler({
        ...spr(null),
        data: { ...spr(null).data, decidable: false },
      }),
    );
    open("APPROVER");
    expect(await screen.findByText(/does not run yet/)).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Approve" }),
    ).not.toBeInTheDocument();
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
