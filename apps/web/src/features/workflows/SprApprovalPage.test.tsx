import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { beforeAll, describe, expect, it } from "vitest";
import i18n from "@/i18n";
import {
  getWorkflowsApproveMockHandler,
  getWorkflowsCompleteTaskMockHandler,
  getWorkflowsCompleteTaskResponseMock,
  getWorkflowsSprMockHandler,
  getWorkflowsSprResponseMock,
} from "@/lib/api/generated/endpoints/workflows/workflows.msw";
import { axeViolations } from "@/test/axe";
import { useToastStore } from "@/components/common/toast";
import { sessionFor } from "@/test/fixtures";
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
        runRate3m: "41.7",
        monthsOfCover: "0.5",
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
      // As the real API answers: nobody stands in and nobody is escalated to.
      substituteName: null,
      escalatesToName: null,
      passedTo: null,
      // Set here, not left to the generated mock: who in the group can decide it.
      approverGroup: {
        approvers: [
          {
            // The signed-in approver, so the form is theirs to use.
            userId: sessionFor("APPROVER").user.id,
            displayName: "Anita Rao",
          },
          {
            userId: "00000000-0000-4000-8000-000000000391",
            displayName: "Wei Ling Tan",
          },
        ],
        reason: null,
      },
      decidable: true,
      stage: decision ? ("decided" as const) : ("with-approvers" as const),
      raiseTaskId: null,
      // Set here, not left to the generated mock, so the page is the same each run.
      due: decision ? null : { dueAt: "2026-11-03T02:00:00Z", overdue: true },
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

function open(role: "APPROVER" | "PRODUCT_MANAGER" | "MANAGEMENT") {
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
    // The vendor, the item and the order open their own records.
    expect(
      await screen.findByRole("link", { name: "Kelmora Power Bank 10000 mAh" }),
    ).toHaveAttribute("href", "/master-data/items/I-0008");
    expect(
      screen.getByRole("link", { name: "Halvorn Components Ltd" }),
    ).toHaveAttribute("href", "/master-data/vendors/V-0001");
    expect(screen.getByRole("link", { name: "SO-0003" })).toHaveAttribute(
      "href",
      "/workflows/orders/SO-0003",
    );
    // jsdom has no layout: the class is what makes each record link a 44 px
    // target under a coarse pointer.
    for (const name of ["Halvorn Components Ltd", "SO-0003"]) {
      expect(screen.getByRole("link", { name })).toHaveClass(
        "pointer-coarse:min-h-11",
      );
    }
    // When it is due, on the request itself, and the steps so far.
    expect(screen.getByText("Overdue since 3 Nov 2026")).toBeInTheDocument();
    expect(screen.getByText("Requested by Prakash Menon")).toBeInTheDocument();
    expect(
      screen.getByText("Waiting for a decision, overdue since 3 Nov 2026"),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/the product manager places the vendor PO/),
    ).toBeInTheDocument();
    const quantity = screen.getByRole("row", { name: /Quantity/ });
    expect(within(quantity).getByText("Suggested")).toBeInTheDocument();
    // Worked out by a rule, so it wears a calculator, never the sparkle that marks AI.
    expect(quantity.querySelector('[data-icon="calculated"]')).not.toBeNull();
    expect(container.querySelector(".lucide-sparkles")).toBeNull();
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
    // Under the group, area 4's list is the answer: no single setup's limit.
    expect(screen.queryByText(/Limited/)).toBeNull();
    // Spectra's figures for raising an SPR, and pieces without decimals.
    expect(
      screen.getByText("Sold a month (3-month average)"),
    ).toBeInTheDocument();
    expect(screen.getByText("41.7")).toBeInTheDocument();
    // 0.5 months of cover is flagged, since it is what makes the SPR urgent.
    expect(screen.getByText("Under a month of stock")).toBeInTheDocument();
    // The decision's facts come before the field-by-field detail.
    const headings = screen
      .getAllByRole("heading")
      .map((heading) => heading.textContent);
    expect(headings.indexOf("Why this SPR")).toBeLessThan(
      headings.indexOf("Fields"),
    );
    expect(screen.getAllByText("98").length).toBeGreaterThan(0);
    expect(screen.queryByText("98.00")).toBeNull();
    // The group as area 4 answers it for this SPR, by name.
    expect(screen.getByText("Anita Rao, Wei Ling Tan")).toBeInTheDocument();
    expect(screen.queryByText("Substitute")).toBeNull();
    expect(screen.queryByText("Escalates to")).toBeNull();
    // People, by name: a raw user id means nothing to staff.
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
      screen.getByText(/Your role cannot decide this yet/),
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
    expect(
      await screen.findByText(/sample from the demo data/),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Approve" }),
    ).not.toBeInTheDocument();
  });

  it("tells the product manager who raised it where it stands, with nothing to decide", async () => {
    server.use(getWorkflowsSprMockHandler(spr(null)));
    open("PRODUCT_MANAGER");
    expect(
      await screen.findByText(/Waiting for a management approver/),
    ).toBeInTheDocument();
    expect(screen.getByText("Decision")).toBeInTheDocument();
    expect(screen.queryByText("Your decision")).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Approve" }),
    ).not.toBeInTheDocument();
  });

  it("says where it stands on a sample too, rather than why a sample cannot be decided", async () => {
    server.use(
      getWorkflowsSprMockHandler({
        ...spr(null),
        data: { ...spr(null).data, decidable: false },
      }),
    );
    open("PRODUCT_MANAGER");
    expect(
      await screen.findByText(/Waiting for a management approver/),
    ).toBeInTheDocument();
    expect(screen.queryByText(/sample from the demo data/)).toBeNull();
  });

  it("offers no decision to someone outside the group, such as Management, and says where it stands", async () => {
    server.use(getWorkflowsSprMockHandler(spr(null)));
    open("MANAGEMENT");
    expect(
      await screen.findByText(/Waiting for a management approver/),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Approve" })).toBeNull();
  });

  it("on a sample, with no group, shows the briefing's rule and no limit or stand-in the setup does not hold", async () => {
    const base = spr(null);
    server.use(
      getWorkflowsSprMockHandler({
        ...base,
        data: {
          ...base.data,
          approver: {
            ...base.data.approver,
            setup: {
              ...base.data.approver.setup,
              unlimitedSalesApproval: true,
              unlimitedPurchaseApproval: true,
              substituteUserId: null,
            },
          },
          substituteName: null,
          escalatesToName: null,
          approverGroup: undefined,
        },
      }),
    );
    open("APPROVER");
    expect(
      await screen.findByText("Any one of three management approvers"),
    ).toBeInTheDocument();
    expect(screen.getByText("None set")).toBeInTheDocument();
    expect(screen.queryByText("Substitute")).toBeNull();
    expect(screen.queryByText("Escalates to")).toBeNull();
  });

  it("lets the product manager raise a suggested SPR from the page, with Undo", async () => {
    const taskId = "00000000-0000-4000-8000-000000000901";
    server.use(
      getWorkflowsSprMockHandler({
        ...spr(null),
        data: {
          ...spr(null).data,
          stage: "suggested",
          raiseTaskId: taskId,
          due: null,
        },
      }),
      getWorkflowsCompleteTaskMockHandler({
        ...getWorkflowsCompleteTaskResponseMock(),
        data: {
          applied: true,
          message: "Recorded. The order has moved on.",
          taskId,
          status: "DONE",
        },
      }),
    );
    const { container } = open("PRODUCT_MANAGER");
    expect(await screen.findByText("Not raised yet")).toBeInTheDocument();
    // Not sent anywhere yet, so the history says who raises it.
    expect(
      screen.getByText("Suggested by the stock check"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Waiting for Prakash Menon to raise it"),
    ).toBeInTheDocument();
    expect(screen.queryByText("Sent to the management approvers")).toBeNull();
    expect(screen.queryByRole("button", { name: "Approve" })).toBeNull();
    expect(await axeViolations(container)).toEqual([]);

    fireEvent.click(screen.getByRole("button", { name: "Raise the SPR" }));

    await waitFor(() => {
      expect(useToastStore.getState().items.at(-1)?.message).toBe(
        "SPR-20261102-0001 raised and sent to the approvers",
      );
    });
    expect(useToastStore.getState().items.at(-1)?.undo).toBeTypeOf("function");
  });

  it("tells an approver that a suggested SPR has not reached them yet", async () => {
    server.use(
      getWorkflowsSprMockHandler({
        ...spr(null),
        data: {
          ...spr(null).data,
          stage: "suggested",
          raiseTaskId: "00000000-0000-4000-8000-000000000901",
          due: null,
        },
      }),
    );
    open("APPROVER");
    expect(
      await screen.findByText(/has not raised this SPR yet/),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Approve" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Raise the SPR" })).toBeNull();
  });

  it("gives a rejected SPR back to the product manager to raise again", async () => {
    const rejected = spr(null);
    server.use(
      getWorkflowsSprMockHandler({
        ...rejected,
        data: {
          ...rejected.data,
          stage: "decided",
          raiseTaskId: "00000000-0000-4000-8000-000000000901",
          due: null,
          decision: {
            outcome: "rejected",
            by: "Anita Rao",
            comment: "Order 60 for now.",
            at: "2026-11-02T05:00:00Z",
          },
        },
      }),
    );
    open("PRODUCT_MANAGER");
    expect(
      await screen.findByText(/Decided: Rejected by Anita Rao/),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Raise it again" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Back with Prakash Menon to correct and raise again"),
    ).toBeInTheDocument();
  });

  it("shows a decision that was already made, with its comment", async () => {
    server.use(
      getWorkflowsSprMockHandler(spr({ outcome: "approved", by: "Anita Rao" })),
    );
    open("APPROVER");
    expect(
      await screen.findByText(/Decided: Approved by Anita Rao/),
    ).toBeInTheDocument();
    // In the decision and again in the history.
    expect(screen.getAllByText("Within my limit.")).toHaveLength(2);
    expect(screen.getByText("Approved by Anita Rao")).toBeInTheDocument();
    expect(screen.queryByText(/Waiting for a decision/)).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Reject" }),
    ).not.toBeInTheDocument();
  });
});
