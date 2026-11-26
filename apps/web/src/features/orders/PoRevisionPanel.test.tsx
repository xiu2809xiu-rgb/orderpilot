import {
  act,
  fireEvent,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import i18n from "@/i18n";
import { useSessionStore } from "@/stores/session";
import { sessionFor } from "@/test/fixtures";
import { axeViolations } from "@/test/axe";
import { renderOrders } from "./orderTestKit";
import {
  answerConfirm,
  EXISTING,
  HttpResponse,
  openPanel,
  previewOf,
  saveRefused,
  serveRevision,
  submittedOrder,
} from "./revisionTestKit";
import { refused } from "./orderTestKit";

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
const confirmButton = () =>
  screen.getByRole("button", { name: "Confirm PO version 2" });
const notRevision = () =>
  screen.getByRole("button", { name: "Not a revision" });
/** The panel's own alert: the notice above it is an alert too. */
const panelAlert = () =>
  within(screen.getByRole("region", { name: /Add this PO as/ })).findByRole(
    "alert",
  );
const filled = () =>
  [...document.querySelectorAll('[data-variant="default"]')].filter(
    (element) => element.closest("[hidden]") === null,
  );

/** The form refused, and the panel open on the differences. */
async function opened(options: Parameters<typeof serveRevision>[0] = {}) {
  const user = userEvent.setup();
  const served = serveRevision(options);
  const view = renderOrders("/orders/new");
  await saveRefused(user);
  const panel = await openPanel(user);
  return { user, panel, view, ...served };
}

describe("the panel that adds a re-sent PO to a submitted order", () => {
  it("opens with the differences and puts focus on its heading, not on Confirm", async () => {
    const { panel } = await opened();
    const heading = within(panel).getByRole("heading", { level: 2 });
    expect(heading).toHaveFocus();
    expect(confirmButton()).not.toHaveFocus();
    // The header first, then the lines that differ.
    expect(within(panel).getByText("Order date")).toBeVisible();
    const table = within(panel).getByRole("table");
    expect(within(table).getByText("I-0001")).toBeVisible();
    expect(within(table).getByText("2 to 5")).toBeVisible();
    expect(panel).toHaveTextContent(
      "These are the differences from PO version 1, the current one. Nothing is saved until you confirm.",
    );
    expect(panel).toHaveTextContent(
      "Confirming does not approve the order, check or reserve stock, or post anything to Business Central.",
    );
    expect(panel).toHaveTextContent(
      "You cannot undo this. PO version 2 becomes",
    );
  });

  it("hides the action bar while the panel is open so the view has one primary", async () => {
    const { user } = await opened();
    expect(screen.queryByRole("button", { name: /^Save/ })).toBeNull();
    expect(filled()).toHaveLength(1);
    expect(filled()[0]).toBe(confirmButton());
    // Closing it brings the bar back.
    await user.click(notRevision());
    expect(await screen.findByRole("button", { name: /^Save$/ })).toBeVisible();
  });

  it("locks the form while the panel is open, and Confirm sends the previewed body", async () => {
    const { user, requests } = await opened();
    answerConfirm(requests, () =>
      refused(409, "CONFLICT", null, "Stop here.")(),
    );
    // Every field is drawn as text or read-only: the lines have no cell to type in.
    expect(
      screen.queryByRole("textbox", { name: "Quantity, line 1" }),
    ).toBeNull();
    await user.type(screen.getByRole("textbox", { name: /PO number/ }), "Z");
    expect(screen.getByRole("textbox", { name: /PO number/ })).toHaveValue(
      "PO-7731",
    );
    await user.click(confirmButton());
    await waitFor(() => {
      expect(requests.confirms).toHaveLength(1);
    });
    expect(requests.confirms[0]).toEqual({
      ...requests.previews[0],
      confirmed: true,
      expectedPoVersionNo: 1,
    });
  });

  it("closes the panel and brings Save back when the form moves on, and sends nothing", async () => {
    const { requests } = await opened();
    // A field the lock missed: the value is changed as a script would change it.
    fireEvent.change(screen.getByRole("textbox", { name: /Prepayment/ }), {
      target: { value: "50.00" },
    });
    await waitFor(() => {
      expect(
        screen.queryByRole("region", { name: /Add this PO as/ }),
      ).toBeNull();
    });
    expect(await screen.findByRole("button", { name: /^Save$/ })).toBeVisible();
    expect(screen.queryByRole("button", { name: OFFER })).toBeNull();
    expect(requests.confirms).toEqual([]);
  });

  it("closes the panel and brings Save back when the notice is hidden, and sends nothing", async () => {
    const { requests } = await opened();
    // A PO number that is not the pair that was refused hides the notice.
    fireEvent.change(screen.getByRole("textbox", { name: /PO number/ }), {
      target: { value: "PO-7732" },
    });
    await waitFor(() => {
      expect(
        screen.queryByRole("region", { name: /Add this PO as/ }),
      ).toBeNull();
    });
    expect(screen.queryByRole("link", { name: `Open ${EXISTING}` })).toBeNull();
    expect(await screen.findByRole("button", { name: /^Save$/ })).toBeVisible();
    expect(requests.confirms).toEqual([]);
  });

  it("shows the stage line from the existing order when a team holds it", async () => {
    const { panel } = await opened({
      stored: submittedOrder({ workflowStatus: "Waiting for payment" }),
    });
    expect(panel).toHaveTextContent("This order is at Waiting for payment.");
    expect(panel).not.toHaveTextContent("No team has a task");
  });

  it("shows the header first with the sentence about today's date and 100%", async () => {
    const { panel } = await opened();
    const header = within(panel).getByText("Order date").closest("dl");
    const sentence = within(panel).getByText(
      "This form starts with today's date and a prepayment of 100% unless you changed them. Check the order date, shipment date and prepayment before you confirm.",
    );
    const table = within(panel).getByRole("table");
    if (!header) throw new Error("no header block");
    expect(
      sentence.compareDocumentPosition(header) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      header.compareDocumentPosition(table) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("warns when the total is zero", async () => {
    const { panel } = await opened({
      differences: (body) =>
        previewOf(body, submittedOrder(), {
          total: { masked: false, from: "36.80", to: "0.00", changed: true },
        }),
    });
    expect(
      within(panel).getByText("The total of this PO is 0.00."),
    ).toBeVisible();
  });

  it("Not a revision closes the panel, returns focus to the offer, unlocks the form and keeps what was typed", async () => {
    const { user } = await opened();
    await user.click(notRevision());
    const offer = await screen.findByRole("button", { name: OFFER });
    await waitFor(() => {
      expect(offer).toHaveFocus();
    });
    expect(
      screen.getByRole("textbox", { name: /PO number/ }),
    ).not.toHaveAttribute("readonly");
    expect(
      screen.getByRole("textbox", { name: "Quantity, line 1" }),
    ).toHaveValue("2");
  });

  it("Escape inside the panel does the same as Not a revision", async () => {
    const { user, panel } = await opened();
    // Focus is on the heading, inside the panel.
    expect(within(panel).getByRole("heading", { level: 2 })).toHaveFocus();
    await user.keyboard("{Escape}");
    await waitFor(() => {
      expect(
        screen.queryByRole("region", { name: /Add this PO as/ }),
      ).toBeNull();
    });
    expect(await screen.findByRole("button", { name: OFFER })).toHaveFocus();
    expect(screen.getByRole("button", { name: /^Save$/ })).toBeVisible();
  });

  it("does nothing on Escape while a confirmation is being sent", async () => {
    const { user, requests } = await opened();
    let release: (response: Response) => void = () => undefined;
    answerConfirm(
      requests,
      () =>
        new Promise<Response>((resolve) => {
          release = resolve;
        }),
    );
    await user.click(confirmButton());
    await screen.findByRole("button", { name: "Saving PO version 2" });
    await user.keyboard("{Escape}");
    expect(
      screen.getByRole("region", { name: /Add this PO as/ }),
    ).toBeVisible();
    act(() => {
      release(refused(409, "CONFLICT", null, "Not now.")());
    });
    expect(await panelAlert()).toBeVisible();
  });

  it("says there is nothing to confirm for identical content and offers no Confirm", async () => {
    const user = userEvent.setup();
    serveRevision({
      differences: (body) =>
        previewOf(body, submittedOrder(), { identical: true, lines: [] }),
    });
    renderOrders("/orders/new");
    await saveRefused(user);
    await user.click(await screen.findByRole("button", { name: OFFER }));
    const panel = await screen.findByRole("region", {
      name: "This PO matches PO version 1",
    });
    expect(panel).toHaveTextContent(
      "This PO has the same dates, quantities and prices as PO version 1, so there is nothing to confirm. Descriptions are not compared.",
    );
    expect(
      screen.queryByRole("button", { name: /^Confirm PO version/ }),
    ).toBeNull();
    expect(
      within(panel).getByRole("link", { name: `Open ${EXISTING}` }),
    ).toBeVisible();
    expect(filled()).toHaveLength(0);
  });

  it("sends confirmed true and the expected number from the preview", async () => {
    const { user, requests } = await opened();
    answerConfirm(requests, () =>
      refused(409, "CONFLICT", null, "Stop here.")(),
    );
    await user.click(confirmButton());
    await waitFor(() => {
      expect(requests.confirms).toHaveLength(1);
    });
    expect(requests.confirms[0]).toMatchObject({
      confirmed: true,
      expectedPoVersionNo: 1,
      customerNo: "C-0001",
      externalDocumentNo: "PO-7731",
    });
  });

  it("ignores a second press while the request is in flight", async () => {
    const { user, requests } = await opened();
    answerConfirm(requests, () => new Promise<Response>(() => undefined));
    const button = confirmButton();
    await user.click(button);
    const busy = await screen.findByRole("button", {
      name: "Saving PO version 2",
    });
    expect(busy).toHaveAttribute("aria-disabled", "true");
    expect(busy).toHaveAttribute("aria-busy", "true");
    await user.click(busy);
    await user.click(busy);
    expect(requests.confirms).toHaveLength(1);
  });

  it("shows the server's words and trace id, keeps Confirm and offers Open when the other side refuses, saying nothing was saved", async () => {
    const { user, requests } = await opened();
    answerConfirm(requests, () =>
      refused(
        400,
        "VALIDATION_FAILED",
        null,
        "The team that takes this order cannot take a new PO now.",
        "trace-refused-3",
      )(),
    );
    await user.click(confirmButton());
    const alert = await panelAlert();
    expect(alert).toHaveTextContent("PO version 2 was not saved");
    expect(alert).toHaveTextContent(
      "The team that takes this order cannot take a new PO now.",
    );
    expect(alert).toHaveTextContent(
      "Nothing was saved. Ask whoever handles this order, then try again.",
    );
    expect(alert).toHaveTextContent("Trace ID: trace-refused-3");
    await waitFor(() => {
      expect(alert).toHaveFocus();
    });
    expect(confirmButton()).toBeVisible();
    expect(
      screen.getAllByRole("link", { name: `Open ${EXISTING}` }).length,
    ).toBe(2);
  });

  it("shows the stale words with Compare again and no Confirm after a 409 with the current number", async () => {
    const { user, requests } = await opened();
    answerConfirm(requests, () =>
      refused(
        409,
        "CONFLICT",
        [{ path: "currentPoVersionNo", message: "3" }],
        `Order ${EXISTING} is now at PO version 3, and you compared with PO version 1. Compare again before you confirm.`,
      )(),
    );
    await user.click(confirmButton());
    const alert = await panelAlert();
    expect(alert).toHaveTextContent("The order moved on");
    expect(alert).toHaveTextContent(`Order ${EXISTING} is now at PO version 3`);
    expect(alert).toHaveTextContent(
      "Compare again to see the differences from PO version 3.",
    );
    expect(
      screen.queryByRole("button", { name: /^Confirm PO version/ }),
    ).toBeNull();
    const again = screen.getByRole("button", { name: "Compare again" });
    expect(filled()).toEqual([again]);
    const before = requests.previews.length;
    await user.click(again);
    await waitFor(() => {
      expect(requests.previews).toHaveLength(before + 1);
    });
  });

  it("shows the closed words after a 409 with a state", async () => {
    const { user, requests } = await opened();
    answerConfirm(requests, () =>
      refused(
        409,
        "CONFLICT",
        [{ path: "captureState", message: "void" }],
        `Order ${EXISTING} is void, so it cannot be revised. Only a submitted order can be.`,
      )(),
    );
    await user.click(confirmButton());
    const alert = await panelAlert();
    expect(alert).toHaveTextContent(
      "This order cannot take a new PO version now",
    );
    expect(alert).toHaveTextContent("is void, so it cannot be revised");
    expect(
      screen.queryByRole("button", { name: /^Confirm PO version/ }),
    ).toBeNull();
    expect(filled()).toHaveLength(1);
    expect(filled()[0]).toHaveTextContent(`Open ${EXISTING}`);
  });

  it("says the result is unknown after a 500 and does not say nothing was saved", async () => {
    const { user, requests, orderReads } = await opened();
    const reads = orderReads.orderReads;
    answerConfirm(requests, () =>
      refused(500, "INTERNAL_ERROR", null, "x", "trace-500-8")(),
    );
    await user.click(confirmButton());
    const alert = await panelAlert();
    expect(alert).toHaveTextContent("We could not confirm the result");
    expect(alert).toHaveTextContent(
      "PO version 2 may have been saved. Open the order to see which.",
    );
    expect(alert).not.toHaveTextContent("Nothing was saved");
    expect(alert).toHaveTextContent("Trace ID: trace-500-8");
    expect(
      screen.queryByRole("button", { name: /^Confirm PO version/ }),
    ).toBeNull();
    expect(filled()).toHaveLength(0);
    await waitFor(() => {
      expect(orderReads.orderReads).toBeGreaterThan(reads);
    });
  });

  it("lists the issues of a 400", async () => {
    const { user, requests } = await opened();
    answerConfirm(requests, () =>
      refused(400, "VALIDATION_FAILED", [
        {
          path: "lines.0.itemNo",
          message: "No item has this Business Central number.",
        },
        {
          path: "shipmentDate",
          message: "The shipment date is before the order date.",
        },
      ])(),
    );
    await user.click(confirmButton());
    const alert = await panelAlert();
    expect(alert).toHaveTextContent("PO version 2 was not saved");
    expect(
      within(alert)
        .getAllByRole("listitem")
        .map((item) => item.textContent),
    ).toEqual([
      "No item has this Business Central number.",
      "The shipment date is before the order date.",
    ]);
    expect(confirmButton()).toBeVisible();
  });

  it("does not send when someone else has signed in over the page, and closes the panel", async () => {
    const { requests } = await opened();
    answerConfirm(requests, () =>
      HttpResponse.json({ data: {} }, { status: 500 }),
    );
    act(() => {
      useSessionStore.setState({
        status: "active",
        session: {
          ...sessionFor("SUPPORT"),
          user: { ...sessionFor("SUPPORT").user, id: "someone-else" },
        },
      });
    });
    await waitFor(() => {
      expect(
        screen.queryByRole("region", { name: /Add this PO as/ }),
      ).toBeNull();
    });
    expect(requests.confirms).toEqual([]);
  });

  it("announces that the differences are ready", async () => {
    const { panel } = await opened();
    const statuses = within(panel).getAllByRole("status");
    expect(
      statuses.some(
        (status) =>
          status.textContent ===
          "Differences ready: 1 added, 0 removed, 1 changed, 2 unchanged",
      ),
    ).toBe(true);
  });

  it("is clean for axe with the panel open", async () => {
    const { view } = await opened();
    expect(await axeViolations(view.container)).toEqual([]);
  });
});
