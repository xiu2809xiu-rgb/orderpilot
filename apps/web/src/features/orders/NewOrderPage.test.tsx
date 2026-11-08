import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import i18n from "@/i18n";
import { axeViolations } from "@/test/axe";
import {
  answerWrite,
  draftDetail,
  fakeServer,
  NEW_ORDER_NO,
  refused,
  renderOrders,
  saved,
} from "./orderTestKit";

beforeAll(async () => {
  await i18n.loadNamespaces([
    "orders",
    "common",
    "document-form",
    "form",
    "linesGrid",
    "list-page",
    "components",
  ]);
});

beforeEach(() => {
  localStorage.clear();
});

const customer = () => screen.findByRole("combobox", { name: /^Customer$/ });
const item = () => screen.findByRole("combobox", { name: "Item, line 1" });
const save = () => screen.getByRole("button", { name: /^Save$/ });

/** Fills a whole order the way a person would: by searching, and by number. */
async function fillOrder(user: ReturnType<typeof userEvent.setup>, po: string) {
  await user.type(await customer(), "C-0001");
  await user.click(await screen.findByRole("option", { name: /Quillon/ }));
  await user.type(screen.getByRole("textbox", { name: /PO number/ }), po);
  await user.type(await item(), "I-0001{Enter}");
  // The lookup answers after a pause; Enter then moves to the quantity.
  const quantity = screen.getByRole("textbox", { name: "Quantity, line 1" });
  await waitFor(() => {
    expect(quantity).toHaveFocus();
  });
  await user.keyboard("2");
}

describe("the New order page", () => {
  it("picks the customer by search and sends its Navision number", async () => {
    const user = userEvent.setup();
    const server = fakeServer();
    const { router } = renderOrders("/orders/new");
    await fillOrder(user, "PO-7731");
    expect(await item()).toHaveValue("I-0001  Norvale Wireless Mouse");
    expect(
      screen.getByRole("textbox", { name: /Unit price, line 1/ }),
    ).toHaveValue("18.40");
    expect(await screen.findByText(/40 PCS available/)).toBeVisible();

    answerWrite(
      "post",
      "*/api/v1/orders",
      server.requests.posts,
      saved(draftDetail()),
    );
    await user.click(save());
    await waitFor(() => {
      expect(router.state.location.pathname).toBe(`/orders/${NEW_ORDER_NO}`);
    });
    expect(server.requests.posts).toEqual([
      {
        customerNo: "C-0001",
        externalDocumentNo: "PO-7731",
        orderDate: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/) as string,
        shipmentDate: null,
        prepaymentPercent: "100.00",
        lines: [
          {
            itemNo: "I-0001",
            description: "Norvale Wireless Mouse",
            quantity: "2",
            unitPrice: "18.40",
          },
        ],
      },
    ]);
  });

  it("saves and starts the next order on the same page", async () => {
    const user = userEvent.setup();
    const server = fakeServer();
    const { router } = renderOrders("/orders/new");
    answerWrite("post", "*/api/v1/orders", [], saved(draftDetail()));
    await fillOrder(user, "PO-7732");
    await user.click(screen.getByRole("button", { name: /Save and new/ }));
    expect(
      await screen.findByText(/Order SO-20261109-0001 saved/),
    ).toBeVisible();
    expect(router.state.location.pathname).toBe("/orders/new");
    expect(screen.getByRole("textbox", { name: /PO number/ })).toHaveValue("");
    expect(server.requests.itemReads).toBeGreaterThan(0);
  });

  it("names the order a repeated PO number belongs to, with a link and no stray line", async () => {
    const user = userEvent.setup();
    fakeServer();
    renderOrders("/orders/new");
    answerWrite(
      "post",
      "*/api/v1/orders",
      [],
      refused(
        409,
        "CONFLICT",
        [
          {
            path: "externalDocumentNo",
            message: "This customer already has an order with this PO.",
          },
          { path: "existingOrderNo", message: "SO-20261108-0007" },
        ],
        "That PO number is already an order.",
        "trace-dup-1",
      ),
    );
    await fillOrder(user, "PO-7731");
    await user.click(save());
    const link = await screen.findByRole("link", {
      name: "Open SO-20261108-0007",
    });
    expect(link).toHaveAttribute("href", "/orders/SO-20261108-0007");
    expect(
      screen.getByText("This customer already has an order with this PO."),
    ).toBeVisible();
    // The number is in the notice only: no bullet of its own on the form.
    expect(screen.queryAllByRole("listitem")).toEqual([]);
    expect(screen.getAllByText(/SO-20261108-0007/)).toHaveLength(2);
    await user.type(screen.getByRole("textbox", { name: /PO number/ }), "X");
    expect(screen.queryByRole("link", { name: /Open SO-/ })).toBeNull();
  });

  it("puts a refused item on its own line", async () => {
    const user = userEvent.setup();
    fakeServer();
    renderOrders("/orders/new");
    answerWrite(
      "post",
      "*/api/v1/orders",
      [],
      refused(400, "VALIDATION_FAILED", [
        { path: "lines.0.itemNo", message: "No such item." },
      ]),
    );
    await fillOrder(user, "PO-7733");
    await user.click(save());
    expect(await screen.findByText("No such item.")).toBeVisible();
  });

  it("asks a role that may not see prices for none, and sends none", async () => {
    const user = userEvent.setup();
    const server = fakeServer({ masked: true });
    renderOrders("/orders/new", "WAREHOUSE", ["orders.create"]);
    answerWrite(
      "post",
      "*/api/v1/orders",
      server.requests.posts,
      saved(draftDetail()),
    );
    await fillOrder(user, "PO-7734");
    await user.click(save());
    await waitFor(() => {
      expect(server.requests.posts).toHaveLength(1);
    });
    expect(JSON.stringify(server.requests.posts[0])).not.toContain("unitPrice");
    expect(screen.queryByRole("textbox", { name: /Unit price/ })).toBeNull();
  });

  it("says why a role without the permission cannot start one, and asks for nothing", async () => {
    const server = fakeServer();
    const view = renderOrders("/orders/new", "WAREHOUSE");
    expect(
      await screen.findByText("Your role may read orders but not start them."),
    ).toBeVisible();
    expect(screen.queryByRole("button", { name: /^Save/ })).toBeNull();
    expect(server.requests.itemReads).toBe(0);
    expect(await axeViolations(view.container)).toEqual([]);
  });

  it("is clean for axe with its header and lines on screen", async () => {
    const server = fakeServer();
    const view = renderOrders("/orders/new");
    await customer();
    expect(server.requests.itemReads).toBe(1);
    const lines = screen.getByRole("table", { name: "Order lines" });
    expect(within(lines).getAllByRole("row").length).toBeGreaterThan(0);
    expect(await axeViolations(view.container)).toEqual([]);
  });
});
