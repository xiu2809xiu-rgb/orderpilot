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

type User = ReturnType<typeof userEvent.setup>;

const unitPrice = () =>
  screen.getByRole("textbox", { name: /Unit price, line 1/ });

async function pickCustomer(user: User, number = "C-0001", name = /Quillon/) {
  const box = await screen.findByRole("combobox", { name: /^Customer$/ });
  await user.type(box, `{Control>}a{/Control}${number}`);
  await user.click(await screen.findByRole("option", { name }));
}

async function pickItem(user: User) {
  const box = await screen.findByRole("combobox", { name: "Item, line 1" });
  await user.type(box, `{Control>}a{/Control}I-0001{Enter}`);
  await waitFor(() => {
    expect(
      screen.getByRole("textbox", { name: "Quantity, line 1" }),
    ).toHaveFocus();
  });
}

// The customer's PO sets the price (ADR 0047, decision 10): picking an item
// never fills it, and the field says where its figure comes from.
describe("the price of an order line", () => {
  it("stays empty when the item is chosen, and says it comes from the PO", async () => {
    const user = userEvent.setup();
    fakeServer();
    renderOrders("/orders/new");
    await pickItem(user);
    expect(unitPrice()).toHaveValue("");
    expect(unitPrice()).toHaveAttribute("placeholder", "From the PO");
  });

  it("stays empty when the customer's last price arrives, which is shown beside it", async () => {
    const user = userEvent.setup();
    fakeServer();
    renderOrders("/orders/new");
    await pickCustomer(user);
    await pickItem(user);
    expect(await screen.findByText("Last USD 17.90")).toBeVisible();
    expect(unitPrice()).toHaveValue("");
  });

  it("stays empty for a customer with no earlier price, and says so", async () => {
    const user = userEvent.setup();
    fakeServer({ lastPrice: () => null });
    renderOrders("/orders/new");
    await pickCustomer(user);
    await pickItem(user);
    expect(await screen.findByText("No earlier price")).toBeVisible();
    expect(unitPrice()).toHaveValue("");
  });

  it("keeps the price the person typed when the same item is chosen again", async () => {
    const user = userEvent.setup();
    fakeServer();
    renderOrders("/orders/new");
    await pickCustomer(user);
    await pickItem(user);
    await user.type(unitPrice(), "15.00");
    await pickItem(user);
    expect(await screen.findByText("Last USD 17.90")).toBeVisible();
    expect(unitPrice()).toHaveValue("15.00");
  });

  it("shows no price field and asks for no last price for a role that may not see prices", async () => {
    const user = userEvent.setup();
    const server = fakeServer({ masked: true });
    renderOrders("/orders/new", "WAREHOUSE", ["orders.create"]);
    await pickItem(user);
    expect(screen.queryByRole("textbox", { name: /Unit price/ })).toBeNull();
    expect(server.requests.lastPriceReads).toBe(0);
  });
});
