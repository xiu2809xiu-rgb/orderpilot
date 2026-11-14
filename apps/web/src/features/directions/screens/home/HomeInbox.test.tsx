import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { useToastStore } from "@/components/common/toast";
import { useSessionStore } from "@/stores/session";
import { server } from "@/test/server";
import { HttpResponse, delay, http } from "msw";
import { axeViolations } from "@/test/axe";
import {
  loadHomeNamespaces,
  makeTask,
  renderHome,
  serveHome,
} from "./homeTestKit";

/**
 * What the old home protected for a role with an inbox, on the new home: the
 * loading, partial, empty, failed and refused states, the one-click action
 * with its Undo, where focus goes when a row leaves, the touch sizes, the
 * money on a payment shown whole, and the link to the whole inbox.
 */
const PACK = makeTask({ orderNo: "SO-0100", amount: "12340.00" });
const SECOND = makeTask({ orderNo: "SO-0101" });

function needs() {
  return screen.getByRole("region", { name: "Needs you" });
}

function tile(name: RegExp) {
  const tiles = screen.getByRole("region", { name: "Your numbers" });
  return within(tiles).getByRole("link", { name });
}

beforeAll(async () => {
  await loadHomeNamespaces();
});

beforeEach(() => {
  useSessionStore.setState({ status: "idle", session: null });
  useToastStore.setState({ items: [] });
});

describe("the home page of a role with an inbox", () => {
  it("shows a skeleton for each tile and the task list while they load", async () => {
    server.use(
      http.get("*/api/v1/*", async () => {
        await delay("infinite");
        return HttpResponse.json({});
      }),
    );
    renderHome("WAREHOUSE");
    expect(
      await screen.findByRole("heading", { name: "Needs you" }),
    ).toBeVisible();
    // The list is announced once as loading, and the page has the shape of its rows.
    expect(within(needs()).getByRole("status")).toHaveTextContent("Loading");
    expect(
      await screen.findByRole("status", { name: "Loading Ready to pick" }),
    ).toBeInTheDocument();
  });

  it("keeps the page up when one tile fails, and offers a retry", async () => {
    serveHome({ tasks: [PACK], trackerStatus: 500 });
    renderHome("WAREHOUSE");
    const retry = await screen.findByRole("button", {
      name: "Could not load Ready to pick. Retry",
    });
    expect(retry).toBeVisible();
    await waitFor(() => {
      expect(tile(/My tasks/)).toHaveTextContent("1");
    });
    expect(await within(needs()).findByText("Pack the order")).toBeVisible();
  });

  it("says nothing needs the person, and shows a count of zero as 0", async () => {
    serveHome({ tasks: [] });
    renderHome("WAREHOUSE");
    expect(
      await screen.findByText("Nothing needs you right now"),
    ).toBeInTheDocument();
    await waitFor(() => {
      expect(tile(/My tasks/)).toHaveTextContent("0");
    });
  });

  it("does the task in one click: the row leaves, the count drops and Undo is offered", async () => {
    const served = serveHome({ tasks: [PACK] });
    const { container } = renderHome("WAREHOUSE");
    const action = await screen.findByRole("button", {
      name: "Mark packed for SO-0100",
    });
    await waitFor(() => {
      expect(tile(/My tasks/)).toHaveTextContent("1");
    });
    expect(screen.getByText("USD 12,340.00")).toBeVisible();
    expect(await axeViolations(container)).toEqual([]);

    fireEvent.click(action);
    await waitFor(() => {
      expect(served.done).toEqual([PACK.id]);
    });
    expect(
      await screen.findByText("Nothing needs you right now"),
    ).toBeInTheDocument();
    await waitFor(() => {
      expect(tile(/My tasks/)).toHaveTextContent("0");
    });
    const toast = useToastStore.getState().items.at(-1);
    expect(toast?.message).toBe("Marked SO-0100 as packed");
    expect(toast?.undo).toBeTypeOf("function");
  });

  it("brings the row back on Undo, and puts focus on its action", async () => {
    const user = userEvent.setup();
    const served = serveHome({ tasks: [PACK] });
    renderHome("WAREHOUSE");
    await user.click(
      await screen.findByRole("button", { name: "Mark packed for SO-0100" }),
    );
    await screen.findByText("Nothing needs you right now");
    await user.click(await screen.findByRole("button", { name: "Undo" }));
    await waitFor(() => {
      expect(served.calls).toContain(`POST undo ${PACK.id}`);
    });
    const back = await screen.findByRole("button", {
      name: "Mark packed for SO-0100",
    });
    await waitFor(() => {
      expect(back).toHaveFocus();
    });
  });

  it("moves focus to the next row's action when a row leaves", async () => {
    const user = userEvent.setup();
    serveHome({ tasks: [PACK, SECOND] });
    renderHome("WAREHOUSE");
    await user.click(
      await screen.findByRole("button", { name: "Mark packed for SO-0100" }),
    );
    const next = await screen.findByRole("button", {
      name: "Mark packed for SO-0101",
    });
    await waitFor(() => {
      expect(next).toHaveFocus();
    });
  });

  it("puts focus on the section's heading when the last row leaves", async () => {
    const user = userEvent.setup();
    serveHome({ tasks: [PACK] });
    renderHome("WAREHOUSE");
    await user.click(
      await screen.findByRole("button", { name: "Mark packed for SO-0100" }),
    );
    await screen.findByText("Nothing needs you right now");
    await waitFor(() => {
      expect(
        within(needs()).getByRole("heading", { name: "Needs you" }),
      ).toHaveFocus();
    });
  });

  it("gives a touch screen 44 px targets on the action and the order link", async () => {
    serveHome({ tasks: [PACK] });
    renderHome("WAREHOUSE");
    const action = await screen.findByRole("button", {
      name: "Mark packed for SO-0100",
    });
    expect(action.className).toContain("pointer-coarse:min-h-11");
    expect(screen.getByRole("link", { name: "SO-0100" }).className).toContain(
      "pointer-coarse:min-h-11",
    );
  });

  it("approves an SPR in one click and reverses it on Undo", async () => {
    const user = userEvent.setup();
    const approval = makeTask({
      kind: "APPROVE_SPR",
      assigneeRole: "APPROVER",
      orderNo: "SO-0200",
      ref: { recordNo: "SPR-20261102-0001", navisionNo: null },
    });
    const served = serveHome({ tasks: [approval] });
    renderHome("APPROVER");
    expect(
      await screen.findByRole("link", { name: "SPR-20261102-0001" }),
    ).toHaveAttribute("href", "/workflows/sprs/SPR-20261102-0001");
    await user.click(
      await screen.findByRole("button", { name: "Approve for SO-0200" }),
    );
    await waitFor(() => {
      expect(served.calls).toContain("POST approve SPR-20261102-0001");
    });
    expect(useToastStore.getState().items.at(-1)?.message).toBe(
      "Approved the SPR for SO-0200",
    );
    await user.click(await screen.findByRole("button", { name: "Undo" }));
    await waitFor(() => {
      expect(served.calls).toContain("POST undo-decision SPR-20261102-0001");
    });
  });

  it("opens the order for a task the person decides there, instead of a button that would guess", async () => {
    const approval = makeTask({
      kind: "APPROVE_SPR",
      assigneeRole: "APPROVER",
      orderNo: "SO-0201",
      ref: null,
    });
    serveHome({ tasks: [approval] });
    renderHome("APPROVER");
    expect(
      await screen.findByRole("link", { name: "Review for SO-0201" }),
    ).toHaveAttribute("href", "/orders/SO-0201");
  });

  // The money a person confirms must be there whole, in the row, and never
  // behind a sideways scroll or cut off at the edge of a card.
  it("confirms a payment in one click and shows its part and its whole in the row", async () => {
    const user = userEvent.setup();
    const payment = makeTask({
      kind: "CONFIRM_PAYMENT",
      assigneeRole: "FINANCE",
      orderNo: "SO-0300",
      amount: "10607.54",
      expectedPayment: {
        paymentType: "prepayment",
        amount: "5303.77",
        currencyCode: "USD",
      },
    });
    const served = serveHome({ tasks: [payment] });
    renderHome("FINANCE");
    const row = (
      await within(needs()).findByText("Confirm the payment")
    ).closest("[role='listitem']");
    if (!(row instanceof HTMLElement)) throw new Error("No row");
    expect(within(row).getByText("USD 5,303.77 of 10,607.54")).toBeVisible();
    expect(within(needs()).queryByRole("table")).toBeNull();
    expect(needs().querySelector(".overflow-x-auto, [data-scroll]")).toBeNull();
    await user.click(
      within(row).getByRole("button", { name: "Confirm for SO-0300" }),
    );
    await waitFor(() => {
      expect(served.calls).toContain("POST payment SO-0300");
    });
  });

  it("counts the rest and links to the whole inbox when there are more tasks than rows", async () => {
    const many = Array.from({ length: 11 }, (_, index) =>
      makeTask({ orderNo: `SO-${String(500 + index)}` }),
    );
    serveHome({ tasks: many });
    renderHome("WAREHOUSE");
    expect(await screen.findByText("3 more waiting")).toBeVisible();
    expect(
      screen.getByRole("link", { name: "View all 11 tasks" }),
    ).toHaveAttribute("href", "/workflows");
    expect(within(needs()).getAllByRole("listitem")).toHaveLength(8);
  });

  it("has no link to the inbox when every task is already listed", async () => {
    serveHome({ tasks: [PACK, SECOND] });
    renderHome("WAREHOUSE");
    await screen.findAllByRole("button", { name: /^Mark packed for/ });
    expect(screen.queryByRole("link", { name: /^View all/ })).toBeNull();
  });

  it("shows the error with its trace id and a retry when the tasks cannot load", async () => {
    const served = serveHome({ tasksStatus: 500 });
    renderHome("WAREHOUSE");
    const alert = await within(needs()).findByRole("alert");
    expect(alert).toHaveTextContent("trace-home-1");
    const before = served.calls.length;
    fireEvent.click(within(alert).getByRole("button", { name: "Try again" }));
    await waitFor(() => {
      expect(served.calls.length).toBeGreaterThan(before);
    });
    // The rest of the page stays up.
    expect(screen.getByRole("region", { name: "Your numbers" })).toBeVisible();
  });

  it("says the role may not read the tasks when the server refuses", async () => {
    serveHome({ tasksStatus: 403 });
    renderHome("WAREHOUSE");
    expect(
      await within(needs()).findByRole("heading", {
        name: "You do not have access to this",
      }),
    ).toBeVisible();
  });
});
