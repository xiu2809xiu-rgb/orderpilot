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

describe("the price a line starts with", () => {
  it("is the item's list price when the item is chosen, before any customer", async () => {
    const user = userEvent.setup();
    fakeServer();
    renderOrders("/orders/new");
    await pickItem(user);
    expect(unitPrice()).toHaveValue("18.40");
  });

  it("changes to what the customer last agreed once that is known", async () => {
    const user = userEvent.setup();
    fakeServer();
    renderOrders("/orders/new");
    await pickItem(user);
    await pickCustomer(user);
    await waitFor(() => {
      expect(unitPrice()).toHaveValue("17.90");
    });
  });

  it("goes back to the list price for a customer with no agreed price", async () => {
    const user = userEvent.setup();
    fakeServer({ lastPrice: (no) => (no === "C-0001" ? "17.90" : null) });
    renderOrders("/orders/new");
    await pickCustomer(user);
    await pickItem(user);
    await waitFor(() => {
      expect(unitPrice()).toHaveValue("17.90");
    });
    await pickCustomer(user, "C-0002", /Marlowe/);
    await waitFor(() => {
      expect(unitPrice()).toHaveValue("18.40");
    });
  });

  it("can be typed over, and choosing the same item again does not take it back", async () => {
    const user = userEvent.setup();
    fakeServer();
    renderOrders("/orders/new");
    await pickCustomer(user);
    await pickItem(user);
    await waitFor(() => {
      expect(unitPrice()).toHaveValue("17.90");
    });
    await user.clear(unitPrice());
    await user.type(unitPrice(), "15.00");
    await pickItem(user);
    expect(unitPrice()).toHaveValue("15.00");
    // Give the last-price lookup its turn: it must leave the typed price alone.
    await screen.findByText("Last USD 17.90");
    expect(unitPrice()).toHaveValue("15.00");
  });

  it("is not replaced by an agreed price that arrives after the person typed", async () => {
    const user = userEvent.setup();
    let release: (price: string) => void = () => undefined;
    const held = new Promise<string>((resolve) => {
      release = resolve;
    });
    fakeServer({ lastPrice: () => held });
    renderOrders("/orders/new");
    await pickCustomer(user);
    await pickItem(user);
    expect(unitPrice()).toHaveValue("18.40");
    await user.clear(unitPrice());
    await user.type(unitPrice(), "16.00");
    release("17.90");
    expect(await screen.findByText("Last USD 17.90")).toBeVisible();
    expect(unitPrice()).toHaveValue("16.00");
  });

  it("fills nothing for a role that may not see prices", async () => {
    const user = userEvent.setup();
    const server = fakeServer({ masked: true });
    renderOrders("/orders/new", "WAREHOUSE", ["orders.create"]);
    await pickItem(user);
    expect(screen.queryByRole("textbox", { name: /Unit price/ })).toBeNull();
    expect(server.requests.lastPriceReads).toBe(0);
  });
});
