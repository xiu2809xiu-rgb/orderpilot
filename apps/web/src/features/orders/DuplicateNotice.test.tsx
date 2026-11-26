import { render, screen, within } from "@testing-library/react";
import { createRef } from "react";
import { MemoryRouter } from "react-router";
import { beforeAll, describe, expect, it, vi } from "vitest";
import i18n from "@/i18n";
import { DuplicateNotice } from "./DuplicateNotice";
import type { OrderNotice } from "./OrderNotices";
import type { ExistingOrder } from "./useExistingOrder";
import type { RevisionOffer } from "./usePoRevision";

// One case for each row of the notice's table: what the person is told about
// the order a repeated PO number belongs to, and what they are offered.

beforeAll(async () => {
  await i18n.loadNamespaces(["orders", "common", "components"]);
});

const ORDER = "SO-20261108-0007";
type Duplicate = Extract<OrderNotice, { kind: "duplicate" }>;

const notice = (over: Partial<Duplicate> = {}): Duplicate => ({
  kind: "duplicate",
  orderNo: ORDER,
  customerNo: "C-0001",
  po: "PO-7731",
  fromCreate: true,
  body: null,
  formKey: "k",
  ...over,
});

const NOTHING = {
  next: null,
  current: null,
  orderDate: null,
  lineCount: null,
  currency: null,
  stage: null,
} as const;

const existing = (kind: ExistingOrder["kind"]): ExistingOrder => ({
  kind,
  ...NOTHING,
});

const submitted: ExistingOrder = {
  kind: "submitted",
  next: 2,
  current: 1,
  orderDate: "2026-11-08",
  lineCount: 3,
  currency: "USD",
  stage: null,
};

const offer = (): RevisionOffer => ({
  onOpen: vi.fn(),
  buttonRef: createRef<HTMLButtonElement>(),
  expanded: false,
});

function draw(
  props: Partial<Parameters<typeof DuplicateNotice>[0]> & {
    existing: ExistingOrder | null;
  },
) {
  return render(
    <MemoryRouter>
      <DuplicateNotice
        notice={notice()}
        offer={null}
        moved={false}
        mayEdit
        {...props}
      />
    </MemoryRouter>,
  );
}

const OFFER = `This PO revises ${ORDER}`;
const status = () => screen.getByRole("status");
const alertOf = () => screen.getByRole("alert");
const BODY = `This customer and PO number already have an order, ${ORDER}. Open it to see it.`;

describe("the notice of a repeated PO number", () => {
  it("always says the order exists, in its alert, and links to it", () => {
    draw({ existing: null });
    expect(alertOf()).toHaveTextContent("This order already exists");
    expect(alertOf()).toHaveTextContent(BODY);
    expect(screen.getByRole("link", { name: `Open ${ORDER}` })).toHaveAttribute(
      "href",
      `/orders/${ORDER}`,
    );
  });

  it("while the order is read: says it is checking, marks the status busy, and offers nothing", () => {
    draw({ existing: existing("reading") });
    expect(status()).toHaveTextContent(
      `Checking whether ${ORDER} can take a new PO version.`,
    );
    expect(status()).toHaveAttribute("aria-busy", "true");
    expect(screen.queryByRole("button", { name: OFFER })).toBeNull();
  });

  it("for a draft: says it is still a draft and offers nothing", () => {
    draw({ existing: existing("draft") });
    expect(status()).toHaveTextContent(
      `${ORDER} is still a draft. Open it to edit it.`,
    );
    expect(status()).toHaveAttribute("aria-busy", "false");
    expect(screen.queryByRole("button", { name: OFFER })).toBeNull();
  });

  it("for a submitted order and a role that may edit: states the order, its next version, and offers the revision", () => {
    draw({ existing: submitted, offer: offer() });
    expect(status()).toHaveTextContent(
      `${ORDER} is submitted: order date 8 Nov 2026, 3 lines, PO version 1. If this is the customer's revised PO, you can confirm it as PO version 2.`,
    );
    const button = screen.getByRole("button", { name: OFFER });
    expect(button).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByRole("link", { name: `Open ${ORDER}` })).toBeVisible();
  });

  it("for a submitted order and a role that may not edit: says what a role that may edit can do, and offers nothing", () => {
    draw({ existing: submitted, mayEdit: false });
    expect(status()).toHaveTextContent(
      `${ORDER} is submitted. A role that may edit orders can confirm a revised PO as its next PO version. Open the order to read it.`,
    );
    expect(screen.queryByRole("button", { name: OFFER })).toBeNull();
  });

  it("for a void order: says its PO number is free again, and offers nothing", () => {
    draw({ existing: existing("void") });
    expect(status()).toHaveTextContent(
      `${ORDER} was voided just now, so its PO number is free again. Save again to enter this order.`,
    );
    expect(screen.queryByRole("button", { name: OFFER })).toBeNull();
  });

  it("for an order that could not be read: says its state is not known, keeps the link, and offers nothing", () => {
    draw({ existing: existing("unknown") });
    expect(status()).toHaveTextContent(
      `${ORDER} could not be read, so its state is not known. Open it to see it.`,
    );
    expect(screen.getByRole("link", { name: `Open ${ORDER}` })).toBeVisible();
    expect(screen.queryByRole("button", { name: OFFER })).toBeNull();
  });

  it("for the update of a draft onto another order's PO number: says only the fixed words, with no state and no offer", () => {
    // The page reads no order for an update, so `existing` is null there; the
    // notice must hold to that even if an order were handed to it.
    draw({
      notice: notice({ fromCreate: false }),
      existing: existing("draft"),
    });
    expect(alertOf()).toHaveTextContent(BODY);
    expect(status().textContent).toBe("");
    expect(screen.queryByRole("button", { name: OFFER })).toBeNull();
  });

  it("after the form changed: drops the sentences about a submitted order and the offer, and keeps the fixed words", () => {
    draw({ existing: submitted, offer: null, moved: true });
    expect(alertOf()).toHaveTextContent(BODY);
    expect(status().textContent).toBe("");
    expect(screen.queryByRole("button", { name: OFFER })).toBeNull();
    // A draft's sentence stays true whatever was typed since.
    expect(within(document.body).queryByText(/is submitted/)).toBeNull();
  });
});
