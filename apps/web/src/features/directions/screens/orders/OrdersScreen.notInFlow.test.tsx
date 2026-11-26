import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { useSessionStore } from "@/stores/session";
import { sessionFor } from "@/test/fixtures";
import OrdersScreen from "./OrdersScreen";
import { loadNamespaces, nth, renderAt, SPECS, stubApi } from "./ordersTestKit";

/** An order typed in here and submitted: no team holds it, so the tracker does not know it. */
const TYPED = {
  ...nth(SPECS, 1),
  orderNo: "SO-20261108-0002",
  entered: "submitted" as const,
  orderedDaysAgo: 2,
};

const open = (query = "") => renderAt(<OrdersScreen />, `/orders${query}`);

beforeAll(loadNamespaces);

beforeEach(() => {
  useSessionStore.setState({
    status: "active",
    session: sessionFor("SUPPORT"),
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("an order typed in here that no team holds", () => {
  it("says Not in the order flow in the list's stage cell, never Not started", async () => {
    stubApi({ specs: [TYPED] });
    open();
    const link = await screen.findByRole("link", { name: TYPED.orderNo });
    const row = link.closest("tr");
    if (!row) throw new Error("no row");
    expect(within(row).getByText("Not in the order flow")).toBeVisible();
    expect(screen.queryByText("Not started")).toBeNull();
  });

  it("puts it in a last column of the board with the same words as its title", async () => {
    stubApi({ specs: [TYPED] });
    open("?view=stage");
    await screen.findByRole("button", { name: TYPED.orderNo });
    const board = screen.getByRole("region", { name: "Orders by stage" });
    const column = within(board).getByRole("region", {
      name: "Not in the order flow",
    });
    expect(within(column).getByText(TYPED.orderNo)).toBeVisible();
    expect(screen.queryByText("Not started")).toBeNull();
  });

  it("says the same in the peek's status fact and names nobody as holding it, without asking the tracker", async () => {
    const calls = stubApi({ specs: [TYPED] });
    const user = userEvent.setup();
    open();
    const link = await screen.findByRole("link", { name: TYPED.orderNo });
    const row = link.closest("tr");
    if (!row) throw new Error("no row");
    await user.click(within(row).getByText(TYPED.customerName));
    const peek = await screen.findByRole("dialog");
    const status = within(peek).getByText("Status").closest("div");
    const held = within(peek).getByText("Held at").closest("div");
    if (!status || !held) throw new Error("no facts");
    expect(within(status).getByText("Not in the order flow")).toBeVisible();
    expect(within(held).getByText("Nobody")).toBeVisible();
    expect(
      within(peek).getByText(
        "This order has no journey yet: the tracker does not know it.",
      ),
    ).toBeVisible();
    await waitFor(() => {
      expect(
        calls.filter((call) => call.includes("/tracker/orders/SO-")),
      ).toEqual([]);
    });
  });

  it("shows the workflow's label, and asks the tracker, once a team holds it", async () => {
    const calls = stubApi({
      specs: [{ ...TYPED, workflowLabel: "Waiting for payment" }],
    });
    const user = userEvent.setup();
    open();
    const link = await screen.findByRole("link", { name: TYPED.orderNo });
    const row = link.closest("tr");
    if (!row) throw new Error("no row");
    expect(within(row).getByText("Waiting for payment")).toBeVisible();
    expect(within(row).queryByText("Not in the order flow")).toBeNull();
    await user.click(within(row).getByText(TYPED.customerName));
    await screen.findByRole("dialog");
    await waitFor(() => {
      expect(
        calls.some((call) =>
          call.startsWith(`GET /api/v1/tracker/orders/${TYPED.orderNo}`),
        ),
      ).toBe(true);
    });
  });
});
