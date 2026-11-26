import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import i18n from "@/i18n";
import {
  answerWrite,
  draftDetail,
  NEW_ORDER_NO,
  refused,
  renderOrders,
} from "./orderTestKit";
import {
  EXISTING,
  http,
  HttpResponse,
  offerButton,
  saveRefused,
  serveRevision,
  server,
  submittedOrder,
} from "./revisionTestKit";

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
const po = () => screen.getByRole("textbox", { name: /PO number/ });

describe("the offer in the notice of a repeated PO number", () => {
  it("offers 'This PO revises' for a submitted order after a refused create, to a role that may edit", async () => {
    const user = userEvent.setup();
    serveRevision();
    renderOrders("/orders/new");
    await saveRefused(user);
    const offer = await offerButton();
    expect(offer).toBeVisible();
    expect(offer).toHaveAttribute("aria-expanded", "false");
    expect(
      await screen.findByText(
        `${EXISTING} is submitted: order date 8 Nov 2026, 1 line, PO version 1. If this is the customer's revised PO, you can confirm it as PO version 2. If it is a different PO that uses the same number, change the PO number here and save it as a new order.`,
      ),
    ).toBeVisible();
    // The link to the order is still there beside it.
    expect(
      screen.getByRole("link", { name: `Open ${EXISTING}` }),
    ).toHaveAttribute("href", `/orders/${EXISTING}`);
  });

  it("does not offer it when the save was an update of a draft", async () => {
    const user = userEvent.setup();
    serveRevision({ stored: draftDetail({ version: 3 }) });
    // The order the PO number belongs to is submitted, so a create would be
    // offered a revision; the draft being edited is read as itself.
    const reads: string[] = [];
    server.use(
      http.get("*/api/v1/orders/:orderNo", ({ params }) => {
        reads.push(String(params.orderNo));
        return HttpResponse.json({
          data:
            params.orderNo === EXISTING
              ? submittedOrder()
              : draftDetail({ version: 3 }),
        });
      }),
    );
    renderOrders(`/orders/${NEW_ORDER_NO}`);
    answerWrite(
      "patch",
      "*/api/v1/orders/:orderNo",
      [],
      refused(409, "CONFLICT", [
        { path: "existingOrderNo", message: EXISTING },
      ]),
    );
    await screen.findByRole("textbox", { name: "Quantity, line 1" });
    await user.type(po(), "X");
    await user.click(screen.getByRole("button", { name: /^Save$/ }));
    expect(
      await screen.findByRole("link", { name: `Open ${EXISTING}` }),
    ).toBeVisible();
    expect(screen.queryByRole("button", { name: OFFER })).toBeNull();
    // The body alone, and the order named in it was not read for a sentence.
    expect(
      screen.getByText(
        `This customer and PO number already have an order, ${EXISTING}. Open it to see it.`,
      ),
    ).toBeVisible();
    expect(screen.queryByText(/can take a new PO version/)).toBeNull();
    // Only the draft's own page was read: the order named was not.
    expect(reads).not.toContain(EXISTING);
  });

  it("does not offer it when the form changed after the refusal, and keeps the plain notice", async () => {
    const user = userEvent.setup();
    serveRevision();
    renderOrders("/orders/new");
    await saveRefused(user);
    await offerButton();
    const quantity = screen.getByRole("textbox", { name: "Quantity, line 1" });
    await user.type(quantity, "5");
    await waitFor(() => {
      expect(screen.queryByRole("button", { name: OFFER })).toBeNull();
    });
    expect(
      screen.getByRole("link", { name: `Open ${EXISTING}` }),
    ).toBeVisible();
    // The sentences about a submitted order were about the body that was refused.
    expect(screen.queryByText(/you can confirm it as PO version/)).toBeNull();
    // Save brings the offer back for the new body.
    await user.click(screen.getByRole("button", { name: /^Save$/ }));
    expect(await offerButton()).toBeVisible();
  });

  it("does not offer it to a role without orders.edit, and says what the order is", async () => {
    const user = userEvent.setup();
    serveRevision();
    renderOrders("/orders/new", "WAREHOUSE", ["orders.create"]);
    await saveRefused(user);
    expect(
      await screen.findByText(
        `${EXISTING} is submitted. A role that may edit orders can confirm a revised PO as its next PO version. Open the order to read it.`,
      ),
    ).toBeVisible();
    expect(screen.queryByRole("button", { name: OFFER })).toBeNull();
  });

  it.each([
    [
      "a draft",
      () => draftDetail({ orderNo: EXISTING }),
      `${EXISTING} is still a draft. Open it to edit it.`,
    ],
    [
      "a void order",
      () => submittedOrder({ captureState: "void", poVersionNo: null }),
      `${EXISTING} was voided just now, so its PO number is free again. Save again to enter this order.`,
    ],
    [
      "a sample",
      () =>
        submittedOrder({
          source: "sample",
          captureState: null,
          poVersionNo: null,
        }),
      `${EXISTING} could not be read, so its state is not known. Open it to see it.`,
    ],
  ])(
    "words %s in its own sentence, and offers nothing",
    async (_name, stored, words) => {
      const user = userEvent.setup();
      serveRevision({ stored: stored() });
      renderOrders("/orders/new");
      await saveRefused(user);
      expect(await screen.findByText(words)).toBeVisible();
      expect(screen.queryByRole("button", { name: OFFER })).toBeNull();
    },
  );

  it("words an order that cannot be read as unknown, and one still being read as such", async () => {
    const user = userEvent.setup();
    serveRevision();
    server.use(
      http.get("*/api/v1/orders/:orderNo", async () => {
        await new Promise((resolve) => setTimeout(resolve, 150));
        return HttpResponse.json(
          {
            error: {
              code: "FORBIDDEN",
              message: "No.",
              details: null,
              traceId: "trace-403",
            },
          },
          { status: 403 },
        );
      }),
    );
    renderOrders("/orders/new");
    await saveRefused(user);
    const reading = await screen.findByText(
      `Checking whether ${EXISTING} can take a new PO version.`,
    );
    expect(reading).toHaveAttribute("aria-busy", "true");
    expect(
      await screen.findByText(
        `${EXISTING} could not be read, so its state is not known. Open it to see it.`,
      ),
    ).toBeVisible();
    expect(screen.queryByRole("button", { name: OFFER })).toBeNull();
  });

  it("keeps focus on the PO number field after the refusal and announces the state politely, not as a second alert", async () => {
    const user = userEvent.setup();
    serveRevision();
    renderOrders("/orders/new");
    await saveRefused(user);
    const sentence = await screen.findByText(/is submitted: order date/);
    // The title and the fixed words are the alert; the state is a status.
    expect(sentence).toHaveAttribute("role", "status");
    expect(sentence.closest('[role="alert"]')).toBeNull();
    const alert = screen
      .getByText("This order already exists")
      .closest('[role="alert"]');
    expect(alert).not.toBeNull();
    expect(
      within(alert as HTMLElement).queryByText(/is submitted: order date/),
    ).toBeNull();
    await waitFor(() => {
      expect(po()).toHaveFocus();
    });
  });
});
