import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import i18n from "@/i18n";
import { fakeServer, renderOrders } from "./orderTestKit";

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

const orderDate = () => screen.getByLabelText(/Order date/);
const shipmentDate = () => screen.getByLabelText(/Shipment date/);
const po = () => screen.getByRole("textbox", { name: /PO number/ });
const CLASH =
  "The shipment date cannot be before the order date. Choose the order date or a later day.";

async function ready() {
  await screen.findByRole("combobox", { name: /^Customer$/ });
}

describe("the dates of an order", () => {
  it("refuses a shipment date before the order date, at the field", async () => {
    const user = userEvent.setup();
    fakeServer();
    renderOrders("/orders/new");
    await ready();
    await user.clear(orderDate());
    await user.type(orderDate(), "2026-11-20");
    await user.type(shipmentDate(), "2020-01-01");
    await user.tab();
    expect(await screen.findByText(CLASH)).toBeVisible();
    expect(shipmentDate()).toHaveAttribute("aria-invalid", "true");
  });

  it("takes the same day, a later day and none, and clears when the order date moves back", async () => {
    const user = userEvent.setup();
    fakeServer();
    renderOrders("/orders/new");
    await ready();
    await user.clear(orderDate());
    await user.type(orderDate(), "2026-11-20");
    await user.type(shipmentDate(), "2026-11-20");
    await user.tab();
    expect(screen.queryByText(CLASH)).toBeNull();
    await user.clear(shipmentDate());
    await user.type(shipmentDate(), "2026-11-10");
    await user.tab();
    await screen.findByText(CLASH);
    await user.clear(orderDate());
    await user.type(orderDate(), "2026-11-05");
    await waitFor(() => {
      expect(screen.queryByText(CLASH)).toBeNull();
    });
  });
});

describe("the PO number", () => {
  it("says the limit and the length at the field, and cuts nothing", async () => {
    const user = userEvent.setup();
    fakeServer();
    renderOrders("/orders/new");
    await ready();
    const long = "PO-".padEnd(41, "7");
    await user.type(po(), long);
    expect(po()).toHaveValue(long);
    await user.tab();
    expect(
      await screen.findByText(
        "A PO number has 35 characters at most, and this one has 41. Shorten it.",
      ),
    ).toBeVisible();
  });

  it("takes exactly 35 characters", async () => {
    const user = userEvent.setup();
    fakeServer();
    renderOrders("/orders/new");
    await ready();
    await user.type(po(), "PO-".padEnd(35, "7"));
    await user.tab();
    expect(screen.queryByText(/characters at most/)).toBeNull();
  });
});

describe("the words of the line messages", () => {
  it("each says what to do, and not only what is wrong", async () => {
    const user = userEvent.setup();
    fakeServer();
    renderOrders("/orders/new");
    await ready();
    // Save waits for a change, so one wrong quantity is typed first.
    await user.type(
      screen.getByRole("textbox", { name: "Quantity, line 1" }),
      "0",
    );
    await user.click(screen.getByRole("button", { name: /^Save$/ }));
    for (const text of [
      "Choose the customer from the list.",
      "Enter the customer's PO number.",
      "Choose an item from the list.",
      "Enter a quantity above zero.",
      "Enter a unit price, for example 12.50.",
    ]) {
      expect((await screen.findAllByText(text)).length).toBeGreaterThan(0);
    }
  });
});
