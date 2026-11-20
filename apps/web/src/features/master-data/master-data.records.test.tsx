import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import {
  getMasterDataCustomerMockHandler,
  getMasterDataCustomersMockHandler,
  getMasterDataFiltersMockHandler,
  getMasterDataItemMockHandler,
  getMasterDataItemsMockHandler,
  getMasterDataVendorMockHandler,
  getMasterDataVendorsMockHandler,
} from "@/lib/api/generated/endpoints/master-data/master-data.msw";
import type {
  MasterDataCustomer200,
  MasterDataVendor200,
} from "@/lib/api/generated/model";
import locale from "@/locales/en/master-data.json";
import { axeViolations } from "@/test/axe";
import { server } from "@/test/server";
import {
  filters,
  hidden,
  itemList,
  load,
  renderAt,
  row,
  shortItem,
  shown,
} from "./masterDataTestKit";

const vendorDetail = {
  data: {
    no: "V-0001",
    name: "Synthetic Vendor One",
    currencyCode: "USD",
    paymentTermsCode: "30 DAYS",
    balanceLcy: shown("vendor.balanceLcy", "1200.00"),
    bankAccounts: [],
    openPurchaseOrders: [],
    items: [],
  },
  meta: { mock: true },
} as MasterDataVendor200;

const customerDetail = (patch: Record<string, unknown> = {}) =>
  ({
    data: {
      no: "C-0003",
      name: "Synthetic Traders",
      countryRegionCode: "IN",
      currencyCode: "USD",
      paymentTermsCode: "30% DEPOSIT",
      addressLine1: "12 Synthetic Road",
      addressLine2: "",
      city: "Mumbai",
      state: "Maharashtra",
      postalCode: "400001",
      taxRegistrationNumber: "INZZ00000000001",
      creditLimitLcy: shown("customer.creditLimitLcy", "108000.00"),
      balanceLcy: shown("customer.balanceLcy", "34107.09"),
      openOrders: [
        {
          orderNo: "SO-0031",
          externalDocumentNo: "PO-IN-4301",
          orderDate: "2026-11-02",
          shipmentDate: null,
          status: "Packing",
          amount: shown("order.amount", "5000.00"),
        },
      ],
      overdueOrders: [
        {
          orderNo: "SO-0024",
          externalDocumentNo: "PO-IN-4261",
          daysOverdue: 11,
          step: "Bill of lading",
          dueDate: "2026-10-22",
        },
      ],
      ...patch,
    },
    meta: { mock: true },
  }) as MasterDataCustomer200;

describe("a record's heading", () => {
  it("leads an item with its name, and puts its number in a badge that copies it", async () => {
    await load();
    server.use(getMasterDataItemMockHandler(shortItem));
    const user = userEvent.setup();
    renderAt("/master-data/items/I-0004");
    const heading = await screen.findByRole("heading", { level: 1 });
    expect(heading).toHaveTextContent("Synthetic switch I-0004");
    const copy = screen.getByRole("button", {
      name: "Copy item number I-0004",
    });
    expect(copy).toHaveTextContent("I-0004");
    await user.click(copy);
    expect(await navigator.clipboard.readText()).toBe("I-0004");
    expect(await screen.findByText("Copied")).toBeInTheDocument();
  });

  it("does the same for a customer and a vendor", async () => {
    await load();
    server.use(getMasterDataCustomerMockHandler(customerDetail()));
    const first = renderAt("/master-data/customers/C-0003");
    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "Synthetic Traders",
      }),
    ).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Copy customer number C-0003" }),
    ).toHaveTextContent("C-0003");
    first.unmount();

    server.use(getMasterDataVendorMockHandler(vendorDetail));
    renderAt("/master-data/vendors/V-0001");
    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "Synthetic Vendor One",
      }),
    ).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Copy vendor number V-0001" }),
    ).toHaveTextContent("V-0001");
  });
});

describe("stock words", () => {
  it("names the stock the same four ways, with Available last, on the item's page", async () => {
    await load();
    server.use(getMasterDataItemMockHandler(shortItem));
    renderAt("/master-data/items/I-0004");
    await screen.findByRole("heading", { level: 1 });
    const labels = screen
      .getAllByText(/^(On hand|On sales orders|On purchase orders|Available)$/)
      .slice(0, 4)
      .map((element) => element.textContent);
    expect(labels).toEqual([
      "On hand",
      "On sales orders",
      "On purchase orders",
      "Available",
    ]);
    expect(screen.queryByText(/Qty\. on/)).toBeNull();
    expect(screen.queryByText("Inventory")).toBeNull();
  });

  it("uses them in the list's columns, with Available after the three it comes from", async () => {
    await load();
    server.use(
      getMasterDataFiltersMockHandler(filters),
      getMasterDataItemsMockHandler(itemList([row("I-0004", "ok")])),
    );
    renderAt("/master-data/items");
    await screen.findByText("Synthetic switch I-0004");
    const heads = screen
      .getAllByRole("columnheader")
      .map((cell) => cell.textContent);
    expect(heads).toContain("On hand");
    expect(heads.indexOf("On hand")).toBeLessThan(heads.indexOf("Available"));
    expect(heads).not.toContain("Stock");
  });

  it("holds the four words in the locale for the columns that start hidden too", () => {
    expect(locale.items.columns).toMatchObject({
      inventory: "On hand",
      qtyOnSalesOrder: "On sales orders",
      qtyOnPurchOrder: "On purchase orders",
      availableStock: "Available",
    });
  });
});

describe("the rule behind Short", () => {
  it("is one press from the mark on an item's page, with the mouse or the keyboard", async () => {
    await load();
    server.use(getMasterDataItemMockHandler(shortItem));
    const user = userEvent.setup();
    renderAt("/master-data/items/I-0004");
    const rule = await screen.findByRole("button", {
      name: "How Short and Low are decided",
    });
    rule.focus();
    await user.keyboard("{Enter}");
    const dialog = await screen.findByRole("dialog");
    expect(
      within(dialog).getByText(
        /an open order needs more of this item than is Available/,
      ),
    ).toBeVisible();
    expect(within(dialog).getByText(/Available is under 25/)).toBeVisible();
  });

  it("is not offered beside an item that is fine", async () => {
    await load();
    server.use(
      getMasterDataItemMockHandler({
        ...shortItem,
        data: { ...shortItem.data, availability: "ok" as const },
      }),
    );
    renderAt("/master-data/items/I-0004");
    await screen.findByRole("heading", { level: 1 });
    expect(
      screen.queryByRole("button", { name: "How Short and Low are decided" }),
    ).toBeNull();
  });

  it("sits in the Availability column's head on the list", async () => {
    await load();
    server.use(
      getMasterDataFiltersMockHandler(filters),
      getMasterDataItemsMockHandler(itemList([row("I-0004", "short")])),
    );
    renderAt("/master-data/items");
    await screen.findByText("Synthetic switch I-0004");
    const head = screen.getByRole("columnheader", { name: /Availability/ });
    expect(
      within(head).getByRole("button", {
        name: "How Short and Low are decided",
      }),
    ).toBeVisible();
  });
});

describe("payment terms", () => {
  it("read as words on a customer's page, and a code that is not known stays as it is", async () => {
    await load();
    server.use(getMasterDataCustomerMockHandler(customerDetail()));
    const first = renderAt("/master-data/customers/C-0003");
    expect(await screen.findByText("30% deposit")).toBeVisible();
    expect(screen.queryByText("30% DEPOSIT")).toBeNull();
    first.unmount();

    const odd = customerDetail();
    server.use(
      getMasterDataCustomerMockHandler({
        ...odd,
        data: { ...odd.data, paymentTermsCode: "NET 45 EOM" },
      }),
    );
    renderAt("/master-data/customers/C-0003");
    expect(await screen.findByText("NET 45 EOM")).toBeVisible();
  });

  it("read as words in the customers list", async () => {
    await load();
    server.use(
      getMasterDataFiltersMockHandler(filters),
      getMasterDataCustomersMockHandler({
        data: [
          {
            no: "C-0003",
            name: "Synthetic Traders",
            countryRegionCode: "IN",
            currencyCode: "USD",
            paymentTermsCode: "LC AT SIGHT",
            openOrders: 1,
            overdueOrders: 0,
          },
        ],
        meta: { page: 1, pageSize: 25, total: 1, mock: true },
      }),
    );
    renderAt("/master-data/customers");
    expect(await screen.findByText("Letter of credit at sight")).toBeVisible();
  });
});

describe("a column that is hidden for the role", () => {
  const vendorRow = (no: string) => ({
    no,
    name: `Synthetic Vendor ${no}`,
    currencyCode: "USD",
    paymentTermsCode: "30 DAYS",
    openPurchaseOrders: 1,
    itemsSupplied: 2,
    balanceLcy: hidden("vendor.balanceLcy", "role"),
  });

  it("says why once in the vendors list's header and leaves a dash in the cells", async () => {
    await load();
    const user = userEvent.setup();
    server.use(
      getMasterDataVendorsMockHandler({
        data: [vendorRow("V-0001"), vendorRow("V-0002")],
        meta: { page: 1, pageSize: 25, total: 2, mock: true },
      }),
    );
    const view = renderAt("/master-data/vendors", "WAREHOUSE");
    await screen.findByText("Synthetic Vendor V-0001");
    expect(screen.queryByRole("img", { name: "Hidden" })).toBeNull();
    const why = screen.getByRole("button", { name: "Why is Balance hidden?" });
    expect(screen.getAllByText("Hidden for your role")).toHaveLength(2);
    why.focus();
    await user.keyboard("{Enter}");
    expect(
      within(await screen.findByRole("dialog")).getByText(
        "Your role does not include this detail.",
      ),
    ).toBeVisible();
    expect(await axeViolations(view.container)).toEqual([]);
  });

  it("does the same for the price on the items list, with the server's reason", async () => {
    await load();
    const user = userEvent.setup();
    const masked = {
      ...row("I-0004", "ok"),
      unitPrice: hidden("item.unitPrice", "price"),
    };
    server.use(
      getMasterDataFiltersMockHandler(filters),
      getMasterDataItemsMockHandler(itemList([masked])),
    );
    renderAt("/master-data/items", "WAREHOUSE");
    await screen.findByText("Synthetic switch I-0004");
    expect(screen.queryByRole("img", { name: "Hidden" })).toBeNull();
    await user.click(
      screen.getByRole("button", { name: "Why is Price hidden?" }),
    );
    expect(
      within(await screen.findByRole("dialog")).getByText(
        "Prices are hidden unless your role works with pricing.",
      ),
    ).toBeVisible();
  });

  it("leaves a column alone when the role can read it", async () => {
    await load();
    server.use(
      getMasterDataFiltersMockHandler(filters),
      getMasterDataItemsMockHandler(itemList([row("I-0004", "ok")])),
    );
    renderAt("/master-data/items");
    await screen.findByText("Synthetic switch I-0004");
    expect(
      screen.queryByRole("button", { name: /Why is Price hidden/ }),
    ).toBeNull();
    expect(screen.getByText("USD 250.00")).toBeVisible();
  });
});

describe("a customer's open orders", () => {
  it("lists them, each linked to the order's own page, with one link to all of the customer's orders", async () => {
    await load();
    server.use(getMasterDataCustomerMockHandler(customerDetail()));
    const view = renderAt("/master-data/customers/C-0003");
    const section = (
      await screen.findByRole("heading", { name: "Open orders" })
    ).closest("section");
    if (!section) throw new Error("no section");
    expect(
      within(section).getByRole("link", { name: "SO-0031" }),
    ).toHaveAttribute("href", "/orders/SO-0031");
    expect(
      within(section).getByRole("link", { name: "All orders of C-0003" }),
    ).toHaveAttribute("href", "/orders?customer=C-0003");
    expect(
      within(section).getByText("1 order with goods still to ship."),
    ).toBeVisible();
    expect(screen.queryByText(/tracker/i)).toBeNull();
    expect(screen.getByRole("link", { name: "SO-0024" })).toHaveAttribute(
      "href",
      "/orders/SO-0024",
    );
    expect(
      screen.getByRole("link", { name: "See them in Orders" }),
    ).toHaveAttribute("href", "/orders?customer=C-0003&overdue=true");
    expect(await axeViolations(view.container)).toEqual([]);
  });

  it("says so when there are none, and still links to all the customer's orders", async () => {
    await load();
    server.use(
      getMasterDataCustomerMockHandler(
        customerDetail({ openOrders: [], overdueOrders: [] }),
      ),
    );
    renderAt("/master-data/customers/C-0003");
    expect(
      await screen.findByText("This customer has no open orders."),
    ).toBeVisible();
    expect(
      screen.getByRole("link", { name: "All orders of C-0003" }),
    ).toBeVisible();
  });

  it("opens an item's orders on the order's own page too", async () => {
    await load();
    server.use(getMasterDataItemMockHandler(shortItem));
    renderAt("/master-data/items/I-0004");
    await screen.findByRole("heading", { level: 1 });
    const links = screen.getAllByRole("link", { name: "SO-0012" });
    expect(links.length).toBeGreaterThan(0);
    for (const link of links) {
      expect(link).toHaveAttribute("href", "/orders/SO-0012");
    }
  });
});
