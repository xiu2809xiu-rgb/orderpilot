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

const unitPrice = () =>
  screen.getByRole("textbox", { name: /Unit price, line 1/ });

async function pickCustomerAndItem(user: ReturnType<typeof userEvent.setup>) {
  await user.type(
    await screen.findByRole("combobox", { name: /^Customer$/ }),
    "C-0001",
  );
  await user.click(await screen.findByRole("option", { name: /Quillon/ }));
  await user.type(
    await screen.findByRole("combobox", { name: "Item, line 1" }),
    "I-0001{Enter}",
  );
}

async function pickOtherCustomer(user: ReturnType<typeof userEvent.setup>) {
  const box = await screen.findByRole("combobox", { name: /^Customer$/ });
  await user.type(box, "{Control>}a{/Control}C-0002");
  await user.click(await screen.findByRole("option", { name: /Marlowe/ }));
}

describe("the customer's last agreed price beside a line", () => {
  it("shows the price and its date, and never writes it into the line's price", async () => {
    const user = userEvent.setup();
    const server = fakeServer();
    renderOrders("/orders/new");
    await pickCustomerAndItem(user);
    expect(
      await screen.findByText(
        "Last agreed price USD 17.90 on 14 Oct 2026, on SO-0007, for reference",
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("Last USD 17.90")).toBeVisible();
    expect(screen.getByText("14 Oct 2026")).toBeVisible();
    expect(unitPrice()).toHaveValue("");
    expect(server.requests.lastPriceReads).toBeGreaterThan(0);
  });

  it("says No earlier price when the customer never bought the item", async () => {
    const user = userEvent.setup();
    fakeServer({ lastPrice: () => null });
    renderOrders("/orders/new");
    await pickCustomerAndItem(user);
    expect(await screen.findByText("No earlier price")).toBeVisible();
    expect(unitPrice()).toHaveValue("");
  });

  it("asks for nothing until there is a customer and an item", async () => {
    const user = userEvent.setup();
    const server = fakeServer();
    renderOrders("/orders/new");
    await user.type(
      await screen.findByRole("combobox", { name: "Item, line 1" }),
      "I-0001{Enter}",
    );
    await screen.findByText(/40 PCS available/);
    expect(server.requests.lastPriceReads).toBe(0);
    expect(screen.queryByText(/Last agreed price/)).not.toBeInTheDocument();
  });

  it("makes no request and shows no price for a role that sees none", async () => {
    const user = userEvent.setup();
    const server = fakeServer({ masked: true });
    renderOrders("/orders/new", "WAREHOUSE", ["orders.create"]);
    await pickCustomerAndItem(user);
    await screen.findByText(/40 PCS available/);
    await waitFor(() => {
      expect(server.requests.stockReads).toBeGreaterThan(0);
    });
    expect(server.requests.lastPriceReads).toBe(0);
    expect(screen.queryByText(/Last agreed price/)).not.toBeInTheDocument();
    expect(screen.queryByText(/No earlier price/)).not.toBeInTheDocument();
  });

  it("drops the old customer's price at once when another customer is picked", async () => {
    const user = userEvent.setup();
    let release: (price: string) => void = () => undefined;
    const held = new Promise<string>((resolve) => {
      release = resolve;
    });
    fakeServer({
      lastPrice: (no) => (no === "C-0001" ? "17.90" : held),
    });
    renderOrders("/orders/new");
    await pickCustomerAndItem(user);
    expect(await screen.findByText("Last USD 17.90")).toBeVisible();
    await pickOtherCustomer(user);
    await waitFor(() => {
      expect(screen.queryByText("Last USD 17.90")).not.toBeInTheDocument();
    });
    release("21.50");
    expect(await screen.findByText("Last USD 21.50")).toBeVisible();
  });

  it("says Last price not known when the lookup fails", async () => {
    const user = userEvent.setup();
    fakeServer({ lastPriceStatus: () => 500 });
    renderOrders("/orders/new");
    await pickCustomerAndItem(user);
    expect(
      await screen.findByText("Last price not known", {}, { timeout: 8000 }),
    ).toBeVisible();
    expect(screen.queryByText("No earlier price")).not.toBeInTheDocument();
    expect(unitPrice()).toHaveValue("");
  }, 15_000);
});
