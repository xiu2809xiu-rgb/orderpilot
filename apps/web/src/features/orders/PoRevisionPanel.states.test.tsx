import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import i18n from "@/i18n";
import { refused, renderOrders } from "./orderTestKit";
import {
  answerConfirm,
  EXISTING,
  maskedPreviewOf,
  offerButton,
  openPanel,
  previewOf,
  saveRefused,
  serveRevision,
  submittedOrder,
} from "./revisionTestKit";

// The states of the panel that the other files do not reach: the preview while
// it loads, each way the preview can be refused, the panel of a role that sees
// no prices, and where focus goes when a button leaves with the press.

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

const FAILED = "The differences could not be worked out";
const LOADING = "Working out the differences";
const KEEP = "Keep the order's dates and prepayment";
const notRevision = () =>
  screen.getByRole("button", { name: "Not a revision" });
const filled = () =>
  [...document.querySelectorAll('[data-variant="default"]')].filter(
    (element) => element.closest("[hidden]") === null,
  );
const panelOf = (name: string) => screen.findByRole("region", { name });

function gateOf() {
  let release: () => void = () => undefined;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  return { gate, release };
}

/** The create refused, and the offer pressed: the panel is whatever the preview makes it. */
async function offered(options: Parameters<typeof serveRevision>[0] = {}) {
  const user = userEvent.setup();
  const served = serveRevision(options);
  const view = renderOrders("/orders/new");
  await saveRefused(user);
  await user.click(await offerButton());
  return { user, view, ...served };
}

describe("the panel while the preview loads", () => {
  it("shows its heading and a working status, keeps the form locked, and offers only Not a revision", async () => {
    const { gate, release } = gateOf();
    const { user } = await offered({ previewGate: gate });
    const panel = await panelOf(LOADING);
    expect(panel).toHaveAttribute("aria-busy", "true");
    expect(within(panel).getByRole("heading", { level: 2 })).toHaveFocus();
    expect(
      within(panel)
        .getAllByRole("status")
        .map((status) => status.textContent),
    ).toContain(LOADING);
    // No differences, no Confirm, no bar: nothing filled, and the way out.
    expect(
      screen.queryByRole("button", { name: /^Confirm PO version/ }),
    ).toBeNull();
    expect(screen.queryByRole("button", { name: /^Save/ })).toBeNull();
    expect(filled()).toHaveLength(0);
    await user.type(screen.getByRole("textbox", { name: /PO number/ }), "Z");
    expect(screen.getByRole("textbox", { name: /PO number/ })).toHaveValue(
      "PO-7731",
    );
    expect(notRevision()).toBeVisible();
    release();
    expect(
      await screen.findByRole("button", { name: "Confirm PO version 2" }),
    ).toBeVisible();
    expect(panel).toHaveAttribute("aria-busy", "false");
  });
});

describe("a refused preview", () => {
  it("lists the fields of a 400 under the failed title, with Try again and no primary", async () => {
    await offered({
      previewReply: refused(
        400,
        "VALIDATION_FAILED",
        [
          { path: "lines.0.itemNo", message: "No such item." },
          { path: "shipmentDate", message: "Before the order date." },
        ],
        "Check these.",
        "trace-fields-4",
      ),
    });
    const panel = await panelOf(FAILED);
    const alert = within(panel).getByRole("alert");
    expect(alert).toHaveTextContent(FAILED);
    expect(
      within(alert)
        .getAllByRole("listitem")
        .map((item) => item.textContent),
    ).toEqual(["No such item.", "Before the order date."]);
    expect(alert).toHaveTextContent("Trace ID: trace-fields-4");
    expect(
      within(panel).getByRole("button", { name: "Try again" }),
    ).toBeVisible();
    expect(
      within(panel).queryByRole("button", { name: /^Confirm PO version/ }),
    ).toBeNull();
    expect(filled()).toHaveLength(0);
  });

  it("says the order moved on for a stale answer, with its trace id and Try again", async () => {
    await offered({
      previewReply: refused(
        409,
        "CONFLICT",
        [{ path: "currentPoVersionNo", message: "3" }],
        `Order ${EXISTING} is now at PO version 3.`,
        "trace-stale-5",
      ),
    });
    const panel = await panelOf(FAILED);
    const alert = within(panel).getByRole("alert");
    expect(alert).toHaveTextContent("The order moved on");
    expect(alert).toHaveTextContent(
      `Order ${EXISTING} is now at PO version 3.`,
    );
    expect(alert).toHaveTextContent("Trace ID: trace-stale-5");
    expect(
      within(panel).getByRole("button", { name: "Try again" }),
    ).toBeVisible();
    expect(filled()).toHaveLength(0);
  });

  it("says the order is closed, with Open as the one filled button", async () => {
    await offered({
      previewReply: refused(
        409,
        "CONFLICT",
        [{ path: "captureState", message: "void" }],
        `Order ${EXISTING} is void.`,
        "trace-closed-6",
      ),
    });
    const panel = await panelOf(FAILED);
    const alert = within(panel).getByRole("alert");
    expect(alert).toHaveTextContent(
      "This order cannot take a new PO version now",
    );
    expect(alert).toHaveTextContent("Trace ID: trace-closed-6");
    expect(
      within(panel).queryByRole("button", { name: "Try again" }),
    ).toBeNull();
    const open = within(panel).getByRole("link", {
      name: `Open ${EXISTING}`,
    });
    expect(open).toHaveAttribute("href", `/orders/${EXISTING}`);
    expect(filled()).toEqual([open]);
  });

  it("says only that the differences could not be worked out for an unknown failure, with the trace id and Try again", async () => {
    await offered({ previewStatus: 500 });
    const panel = await panelOf(FAILED);
    const alert = within(panel).getByRole("alert");
    expect(alert).toHaveTextContent(FAILED);
    expect(alert).toHaveTextContent("Trace ID: trace-preview-1");
    expect(alert).not.toHaveTextContent("Nothing was saved");
    expect(
      within(panel).getByRole("button", { name: "Try again" }),
    ).toBeVisible();
    expect(filled()).toHaveLength(0);
  });
});

describe("the panel of a role that sees no prices", () => {
  it("shows no price, says prices are not compared, masks with the reason, and counts in the masked form", async () => {
    const user = userEvent.setup();
    serveRevision({
      masked: true,
      differences: (body) => maskedPreviewOf(body),
    });
    renderOrders("/orders/new", "WAREHOUSE", ["orders.create", "orders.edit"]);
    await saveRefused(user, "PO-7731", null);
    const panel = await openPanel(user);
    expect(
      within(panel).getByText("Prices are not compared for your role."),
    ).toBeVisible();
    for (const figure of ["USD", "18.40", "32.50", "125.00"]) {
      expect(panel.textContent).not.toContain(figure);
    }
    expect(
      within(panel).getAllByText(
        /Hidden: prices are for roles that work with pricing/,
      ).length,
    ).toBeGreaterThan(0);
    expect(
      within(panel)
        .getAllByRole("status")
        .map((status) => status.textContent),
    ).toContain(
      "Differences ready: 1 added, 0 removed, 1 changed, 1 moved, 1 with the same quantity",
    );
    expect(filled()).toHaveLength(1);
    expect(filled()[0]).toHaveTextContent("Confirm PO version 2");
  });
});

describe("where focus goes when the pressed button leaves", () => {
  // The panel's own heading: the section that holds "Not a revision".
  const heading = () => {
    const panel = notRevision().closest("section");
    if (!panel) throw new Error("no panel");
    return within(panel).getByRole("heading", { level: 2 });
  };
  const gone = (name: string) =>
    waitFor(() => {
      expect(screen.queryByRole("button", { name })).toBeNull();
    });

  it("moves to the panel heading after Compare again, and stays there", async () => {
    const user = userEvent.setup();
    const { api, requests } = serveRevision();
    renderOrders("/orders/new");
    await saveRefused(user);
    await openPanel(user);
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
    const { gate, release } = gateOf();
    api.previewGate = gate;
    await user.click(again);
    // The button is gone while the new preview loads; focus is on the heading.
    await gone("Compare again");
    expect(heading()).toHaveFocus();
    release();
    await screen.findByRole("button", { name: "Confirm PO version 2" });
    expect(heading()).toHaveFocus();
  });

  it("moves to the panel heading after Try again, and stays there", async () => {
    const { user, api } = await offered({ previewStatus: 500 });
    await panelOf(FAILED);
    const { gate, release } = gateOf();
    api.previewStatus = 200;
    api.previewGate = gate;
    await user.click(screen.getByRole("button", { name: "Try again" }));
    await gone("Try again");
    expect(heading()).toHaveFocus();
    release();
    await screen.findByRole("button", { name: "Confirm PO version 2" });
    expect(heading()).toHaveFocus();
  });

  it("moves to the panel heading after Keep the order's dates and prepayment, and stays there", async () => {
    const user = userEvent.setup();
    const { api } = serveRevision({
      differences: (body) =>
        previewOf(body, submittedOrder({ orderDate: "2026-10-01" })),
    });
    renderOrders("/orders/new");
    await saveRefused(user);
    await openPanel(user);
    const { gate, release } = gateOf();
    api.previewGate = gate;
    await user.click(screen.getByRole("button", { name: KEEP }));
    await gone(KEEP);
    expect(heading()).toHaveFocus();
    release();
    await screen.findByRole("button", { name: "Confirm PO version 2" });
    expect(heading()).toHaveFocus();
  });
});
