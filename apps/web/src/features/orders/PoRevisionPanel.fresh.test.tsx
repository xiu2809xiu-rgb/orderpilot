import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { act } from "react";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import i18n from "@/i18n";
import { useSessionStore } from "@/stores/session";
import { refused, renderOrders } from "./orderTestKit";
import {
  answerConfirm,
  EXISTING,
  fillNewOrder,
  offerButton,
  openPanel,
  previewOf,
  saveRefused,
  serveRevision,
  submittedOrder,
} from "./revisionTestKit";

// What the panel and the notice say must be true of the order as it is now, and
// of the body the form holds: the facts are read again when the order has moved,
// an edit made while the create was in flight takes the offer away, and a
// session that may not read orders does not ask.

beforeAll(async () => {
  await i18n.loadNamespaces([
    "orders",
    "common",
    "document-form",
    "form",
    "linesGrid",
    "list-page",
    "components",
    "directions-orders",
    "directions-parts",
  ]);
});

beforeEach(() => {
  localStorage.clear();
});

const OFFER = `This PO revises ${EXISTING}`;
const KEEP = "Keep the order's dates and prepayment";

function gateOf() {
  let release: () => void = () => undefined;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  return { gate, release };
}

/** The order after someone else revised it twice more, and a team took it. */
const moved = () =>
  submittedOrder({
    poVersionNo: 3,
    version: 6,
    workflowStatus: "Waiting for payment",
  });

const twoLines = () => {
  const [first] = submittedOrder().lines;
  if (!first) throw new Error("no line");
  return [first, { ...first, lineNo: 2, itemNo: "I-0002" }];
};

describe("an edit made while the create is in flight", () => {
  it("takes the offer away when the refusal arrives, and says nothing about the order's state", async () => {
    const { gate, release } = gateOf();
    const user = userEvent.setup();
    const { requests, orderReads } = serveRevision({ createGate: gate });
    renderOrders("/orders/new");
    await fillNewOrder(user, "PO-7731");
    await user.click(screen.getByRole("button", { name: /^Save$/ }));
    await waitFor(() => {
      expect(requests.creates).toHaveLength(1);
    });
    // The form is still open for typing while the request is out.
    await user.type(
      screen.getByRole("textbox", { name: "Quantity, line 1" }),
      "5",
    );
    release();
    expect(await screen.findByText("This order already exists")).toBeVisible();
    // The order is read all the same, so the offer would be drawn by now.
    await waitFor(() => {
      expect(orderReads.orderReads).toBeGreaterThan(0);
    });
    await expect(
      screen.findByRole("button", { name: OFFER }, { timeout: 400 }),
    ).rejects.toThrow();
    expect(screen.queryByText(/is submitted: order date/)).toBeNull();
  });
});

describe("the facts of the order after it moved on", () => {
  it("names the new current version after a stale answer to a confirmation and Compare again", async () => {
    const user = userEvent.setup();
    const { api, requests } = serveRevision();
    renderOrders("/orders/new");
    await saveRefused(user);
    const panel = await openPanel(user);
    expect(panel).toHaveTextContent(
      `${EXISTING} now: order date 8 Nov 2026, 1 line, PO version 1.`,
    );
    api.stored = moved();
    api.differences = (body) => ({
      ...previewOf(body, api.stored),
      fromPoVersionNo: 3,
      toPoVersionNo: 4,
    });
    answerConfirm(requests, () =>
      refused(
        409,
        "CONFLICT",
        [{ path: "currentPoVersionNo", message: "3" }],
        "Moved on.",
      )(),
    );
    await user.click(
      screen.getByRole("button", { name: "Confirm PO version 2" }),
    );
    const again = await screen.findByRole("button", { name: "Compare again" });
    // The stale answer alone makes the page read the order again: the facts
    // above the alert are the new ones before anything is pressed.
    await waitFor(() => {
      expect(panel).toHaveTextContent(
        `${EXISTING} now: order date 8 Nov 2026, 1 line, PO version 3.`,
      );
    });
    await user.click(again);
    await screen.findByRole("button", { name: "Confirm PO version 4" });
    await waitFor(() => {
      expect(panel).toHaveTextContent(
        `${EXISTING} now: order date 8 Nov 2026, 1 line, PO version 3.`,
      );
    });
    expect(panel).toHaveTextContent("This order is at Waiting for payment.");
    expect(panel).not.toHaveTextContent("PO version 1.");
  });

  it("reads the order again on Try again, so the facts agree with the new preview", async () => {
    const user = userEvent.setup();
    const { api } = serveRevision({ previewStatus: 500 });
    renderOrders("/orders/new");
    await saveRefused(user);
    await user.click(await offerButton());
    const retry = await screen.findByRole("button", { name: "Try again" });
    api.previewStatus = 200;
    api.stored = moved();
    api.differences = (body) => ({
      ...previewOf(body, api.stored),
      fromPoVersionNo: 3,
      toPoVersionNo: 4,
    });
    await user.click(retry);
    await screen.findByRole("button", { name: "Confirm PO version 4" });
    const panel = screen.getByRole("region", { name: /Add this PO as/ });
    await waitFor(() => {
      expect(panel).toHaveTextContent(
        `${EXISTING} now: order date 8 Nov 2026, 1 line, PO version 3.`,
      );
    });
    expect(panel).toHaveTextContent("This order is at Waiting for payment.");
  });
});

describe("a session that may not read orders", () => {
  it("does not read the order after a refused create, and words it as unknown with no offer", async () => {
    const user = userEvent.setup();
    const { orderReads } = serveRevision();
    renderOrders("/orders/new");
    const { session } = useSessionStore.getState();
    if (!session) throw new Error("no session");
    act(() => {
      useSessionStore.setState({
        session: {
          ...session,
          permissions: session.permissions.filter((p) => p !== "orders.read"),
        },
      });
    });
    await saveRefused(user);
    expect(
      await screen.findByText(
        `${EXISTING} could not be read, so its state is not known. Open it to see it.`,
      ),
    ).toBeVisible();
    expect(screen.queryByRole("button", { name: OFFER })).toBeNull();
    expect(orderReads.orderReads).toBe(0);
  });
});

describe("one line and two lines", () => {
  it("says 1 line in the notice and in the panel's facts for a one-line order", async () => {
    const user = userEvent.setup();
    serveRevision();
    renderOrders("/orders/new");
    await saveRefused(user);
    expect(
      await screen.findByText(
        /is submitted: order date 8 Nov 2026, 1 line, PO/,
      ),
    ).toBeVisible();
    const panel = await openPanel(user);
    expect(panel).toHaveTextContent(
      "order date 8 Nov 2026, 1 line, PO version 1.",
    );
    expect(panel).not.toHaveTextContent("1 lines");
  });

  it("says 2 lines in the notice and in the panel's facts for a two-line order", async () => {
    const user = userEvent.setup();
    serveRevision({ stored: submittedOrder({ lines: twoLines() }) });
    renderOrders("/orders/new");
    await saveRefused(user);
    expect(
      await screen.findByText(
        /is submitted: order date 8 Nov 2026, 2 lines, PO/,
      ),
    ).toBeVisible();
    const panel = await openPanel(user);
    expect(panel).toHaveTextContent(
      "order date 8 Nov 2026, 2 lines, PO version 1.",
    );
  });
});

describe("the button that replaces what was typed", () => {
  it("says under itself that it replaces the dates and the prepayment typed", async () => {
    const user = userEvent.setup();
    serveRevision({
      differences: (body) =>
        previewOf(body, submittedOrder({ orderDate: "2026-10-01" })),
    });
    renderOrders("/orders/new");
    await saveRefused(user);
    const panel = await openPanel(user);
    const button = within(panel).getByRole("button", { name: KEEP });
    const hint = within(panel).getByText(
      "This replaces the dates and the prepayment you typed.",
    );
    expect(button).toHaveAccessibleDescription(hint.textContent);
    // The hint sits under the button, in the same block.
    expect(button.parentElement).toContainElement(hint);
  });
});
