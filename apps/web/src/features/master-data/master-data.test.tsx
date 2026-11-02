import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { MemoryRouter, Route, Routes } from "react-router";
import { describe, expect, it } from "vitest";
import i18n from "@/i18n";
import {
  getMasterDataCustomerMockHandler,
  getMasterDataFiltersMockHandler,
  getMasterDataItemMockHandler,
  getMasterDataItemsMockHandler,
  getMasterDataVendorMockHandler,
} from "@/lib/api/generated/endpoints/master-data/master-data.msw";
import type {
  MasterDataCustomer200,
  MasterDataFilters200,
  MasterDataItem200,
  MasterDataItems200,
  MasterDataVendor200,
} from "@/lib/api/generated/model";
import { axeViolations } from "@/test/axe";
import { useSessionStore } from "@/stores/session";
import { errorBody, sessionFor } from "@/test/fixtures";
import { server } from "@/test/server";
import CustomerDetailPage from "./CustomerDetailPage";
import ItemDetailPage from "./ItemDetailPage";
import ItemsPage from "./ItemsPage";
import VendorDetailPage from "./VendorDetailPage";

const shown = (field: string, value: string) => ({
  field,
  classification: "confidential" as const,
  masked: false,
  value,
  reason: null,
});

const hidden = (field: string, reason: "price" | "bankDetails" | "role") => ({
  field,
  classification: "restricted" as const,
  masked: true,
  value: null,
  reason,
});

const row = (no: string, availability: "short" | "low" | "ok") => ({
  no,
  description: `Synthetic switch ${no}`,
  partNumber: `PN-${no}`,
  brand: "Synthetic Brand",
  category: "IT" as const,
  baseUnitOfMeasure: "PCS",
  inventory: "120",
  qtyOnSalesOrder: "80",
  qtyOnPurchOrder: "6",
  availableStock: "46",
  availability,
  unitPrice: shown("item.unitPrice", "250.00"),
  vendorNo: "V-0001",
  vendorName: "Synthetic Vendor One",
});

const itemList = (rows: ReturnType<typeof row>[]) =>
  ({
    data: rows,
    meta: { page: 1, pageSize: 25, total: rows.length, mock: true },
  }) as MasterDataItems200;

const filters: MasterDataFilters200 = {
  data: {
    brands: ["Synthetic Brand"],
    categories: ["IT", "SURVEILLANCE", "ACCESSORIES"],
    vendors: [{ no: "V-0001", name: "Synthetic Vendor One" }],
    countries: ["IN"],
    paymentTerms: ["PREPAID"],
    priceGroups: ["DEALER"],
  },
  meta: { mock: true },
};

const shortItem = {
  data: {
    ...row("I-0004", "short"),
    inventory: "70",
    qtyOnSalesOrder: "30",
    vendorItemNo: "VN-77",
    unitCost: hidden("item.unitCost", "price"),
    orderLines: [
      {
        orderNo: "SO-0012",
        customerNo: "C-0003",
        customerName: "Synthetic Traders",
        orderDate: "2026-10-20",
        shipmentDate: null,
        status: "Waiting for SPR",
        quantity: "146",
        heldOut: true,
        shortfall: {
          state: "waiting" as const,
          ordered: "146",
          availableStock: "46",
          shortBy: "100",
          sprRecordNo: "SPR-0009",
          purchaseOrderNo: null,
          purchaseOrderStatus: null,
        },
      },
      {
        orderNo: "SO-0013",
        customerNo: "C-0004",
        customerName: "Synthetic Systems",
        orderDate: "2026-10-22",
        shipmentDate: null,
        status: "Packing",
        quantity: "30",
        heldOut: false,
        shortfall: null,
      },
    ],
    salesOrderBreakdown: { listed: "30", heldOut: "146" },
    purchaseLines: [],
    sprs: [],
  },
  meta: { mock: true },
} as MasterDataItem200;

function renderAt(path: string) {
  useSessionStore.getState().setSession(sessionFor("SUPPORT"));
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/master-data/items" element={<ItemsPage />} />
          <Route path="/master-data/items/:no" element={<ItemDetailPage />} />
          <Route
            path="/master-data/vendors/:no"
            element={<VendorDetailPage />}
          />
          <Route
            path="/master-data/customers/:no"
            element={<CustomerDetailPage />}
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const load = () =>
  i18n.loadNamespaces(["master-data", "common", "components", "list-page"]);

describe("the items list", () => {
  it("lists items with the Mock Navision badge, marks the short one and links each record", async () => {
    await load();
    server.use(
      getMasterDataFiltersMockHandler(filters),
      getMasterDataItemsMockHandler(
        itemList([row("I-0004", "short"), row("I-0005", "ok")]),
      ),
    );
    const view = renderAt("/master-data/items");
    expect(await screen.findByText("Synthetic switch I-0004")).toBeVisible();
    expect(screen.getByText("Mock Navision")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "I-0004" })).toHaveAttribute(
      "href",
      "/master-data/items/I-0004",
    );
    expect(screen.getAllByText("Short").length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: /^New/ })).toBeNull();
    expect(await axeViolations(view.container)).toEqual([]);
  });

  it("sends the filter in the link to the server", async () => {
    await load();
    const seen: string[] = [];
    server.use(
      getMasterDataFiltersMockHandler(filters),
      http.get("*/api/v1/master-data/items", ({ request }) => {
        seen.push(new URL(request.url).search);
        return HttpResponse.json(itemList([row("I-0004", "short")]));
      }),
    );
    renderAt("/master-data/items?availability=short");
    await screen.findByText("Synthetic switch I-0004");
    expect(seen[0]).toContain("availability=short");
  });

  it("shows the error with its trace id and a retry", async () => {
    await load();
    server.use(
      getMasterDataFiltersMockHandler(filters),
      http.get("*/api/v1/master-data/items", () =>
        HttpResponse.json(errorBody("INTERNAL_ERROR", "trace-items-1"), {
          status: 500,
        }),
      ),
    );
    renderAt("/master-data/items");
    const alert = await screen.findByRole("alert");
    expect(within(alert).getByText("trace-items-1")).toBeInTheDocument();
    expect(
      within(alert).getByRole("button", { name: "Try again" }),
    ).toBeVisible();
  });

  it("names the next step when there are no items", async () => {
    await load();
    server.use(
      getMasterDataFiltersMockHandler(filters),
      getMasterDataItemsMockHandler(itemList([])),
    );
    renderAt("/master-data/items");
    expect(await screen.findByText("No items yet")).toBeVisible();
  });
});

describe("an item", () => {
  it("spells out the stock sum and what the short order needs, has and lacks", async () => {
    await load();
    server.use(getMasterDataItemMockHandler(shortItem));
    const view = renderAt("/master-data/items/I-0004");
    expect(
      await screen.findByRole("heading", { name: "I-0004" }),
    ).toBeVisible();
    expect(
      screen.getByText(
        "Available Stock is Inventory minus Qty. on Sales Order plus Qty. on Purch. Order.",
      ),
    ).toBeVisible();
    expect(
      screen.getByText("needs 146, 46 are available, and it is short by 100."),
    ).toBeVisible();
    expect(screen.getByText("Demand under review")).toBeVisible();
    expect(await axeViolations(view.container)).toEqual([]);
  });

  it("calls a line covered by its approved SPR's purchase order, and says when that has arrived", async () => {
    await load();
    const covered = {
      data: {
        ...shortItem.data,
        availability: "low" as const,
        inventory: "176",
        qtyOnSalesOrder: "176",
        qtyOnPurchOrder: "0",
        availableStock: "0",
        orderLines: [
          {
            ...shortItem.data.orderLines[0],
            heldOut: false,
            shortfall: {
              state: "covered" as const,
              ordered: "146",
              availableStock: "46",
              shortBy: "100",
              sprRecordNo: "SPR-0009",
              purchaseOrderNo: "PO-0033",
              purchaseOrderStatus: "received" as const,
            },
          },
          shortItem.data.orderLines[1],
        ],
        salesOrderBreakdown: { listed: "176", heldOut: "0.00" },
        sprs: [
          {
            recordNo: "SPR-0009",
            navisionNo: "PO-0033",
            purchaseOrderStatus: "received" as const,
            orderNo: "SO-0012",
            status: "approved" as const,
            quantity: "100",
            needBy: "2026-11-05",
            requestedBy: "Synthetic Manager",
          },
        ],
      },
      meta: { mock: true },
    } as MasterDataItem200;
    server.use(getMasterDataItemMockHandler(covered));
    const view = renderAt("/master-data/items/I-0004");
    await screen.findByRole("heading", { name: "I-0004" });
    expect(screen.queryByText("Demand under review")).toBeNull();
    expect(screen.getByText("PO-0033 received")).toBeVisible();
    expect(
      screen.getByText("Needed 146 with 46 available, 100 short."),
    ).toBeVisible();
    expect(screen.getByText("Received")).toBeVisible();
    expect(screen.queryByText(/is short by/)).toBeNull();
    expect(screen.getByText("Low")).toBeVisible();
    expect(await axeViolations(view.container)).toEqual([]);
  });

  it("offers to show the item's orders only when it has some", async () => {
    await load();
    server.use(getMasterDataItemMockHandler(shortItem));
    const view = renderAt("/master-data/items/I-0004");
    await screen.findByRole("heading", { name: "I-0004" });
    expect(
      screen.getByRole("link", { name: "See this item's orders" }),
    ).toBeVisible();
    view.unmount();
    server.use(
      getMasterDataItemMockHandler({
        ...shortItem,
        data: {
          ...shortItem.data,
          orderLines: [],
          salesOrderBreakdown: { listed: "0", heldOut: "0" },
        },
      }),
    );
    renderAt("/master-data/items/I-0004");
    await screen.findByText("No open order holds this item.");
    expect(
      screen.queryByRole("link", { name: "See this item's orders" }),
    ).toBeNull();
  });

  it("shows a hidden cost as hidden, with no value", async () => {
    await load();
    server.use(getMasterDataItemMockHandler(shortItem));
    renderAt("/master-data/items/I-0004");
    await screen.findByRole("heading", { name: "I-0004" });
    expect(
      screen.getAllByRole("img", { name: "Hidden" }).length,
    ).toBeGreaterThan(0);
  });

  it("says plainly when Navision has no such item", async () => {
    await load();
    server.use(
      http.get("*/api/v1/master-data/items/:no", () =>
        HttpResponse.json(errorBody("NOT_FOUND", "trace-missing-1"), {
          status: 404,
        }),
      ),
    );
    renderAt("/master-data/items/I-9999");
    expect(await screen.findByText("No such item")).toBeVisible();
    expect(
      screen.getByText("Navision has no item numbered I-9999."),
    ).toBeVisible();
  });
});

describe("a vendor", () => {
  const vendor = (masked: boolean) =>
    ({
      data: {
        no: "V-0001",
        name: "Synthetic Vendor One",
        currencyCode: "USD",
        paymentTermsCode: "NET30",
        balanceLcy: shown("vendor.balanceLcy", "1200.00"),
        bankAccounts: [
          {
            code: "MAIN",
            bankName: masked
              ? hidden("vendor.bankName", "bankDetails")
              : shown("vendor.bankName", "Example Test Bank"),
            bankAccountNo: masked
              ? hidden("vendor.bankAccountNo", "bankDetails")
              : shown("vendor.bankAccountNo", "000-TEST-0001"),
            swiftCode: masked
              ? hidden("vendor.swiftCode", "bankDetails")
              : shown("vendor.swiftCode", "TESTSGS0"),
            iban: masked
              ? hidden("vendor.iban", "bankDetails")
              : shown("vendor.iban", "XX00TEST0000000001"),
          },
        ],
        openPurchaseOrders: [],
        items: [],
      },
      meta: { mock: true },
    }) as MasterDataVendor200;

  it("shows Finance the bank account", async () => {
    await load();
    server.use(getMasterDataVendorMockHandler(vendor(false)));
    renderAt("/master-data/vendors/V-0001");
    expect(await screen.findByText("000-TEST-0001")).toBeVisible();
  });

  it("hides the bank account from another role and offers the reason", async () => {
    await load();
    server.use(getMasterDataVendorMockHandler(vendor(true)));
    const view = renderAt("/master-data/vendors/V-0001");
    await screen.findByRole("heading", { name: "V-0001" });
    expect(screen.queryByText("000-TEST-0001")).toBeNull();
    expect(screen.getAllByRole("img", { name: "Hidden" })).toHaveLength(4);
    const [why] = screen.getAllByRole("button", { name: /Why is this hidden/ });
    if (!why) throw new Error("no reason button");
    await userEvent.click(why);
    expect(
      within(await screen.findByRole("dialog")).getByText(
        "Bank details are hidden unless your role handles payments.",
      ),
    ).toBeVisible();
    expect(await axeViolations(view.container)).toEqual([]);
  });
});

describe("a customer", () => {
  const customer = (masked: boolean) =>
    ({
      data: {
        no: "C-0003",
        name: "Synthetic Traders",
        countryRegionCode: "IN",
        currencyCode: "USD",
        paymentTermsCode: "PREPAID",
        customerPriceGroup: "DEALER",
        creditLimitLcy: masked
          ? hidden("customer.creditLimitLcy", "role")
          : shown("customer.creditLimitLcy", "108000.00"),
        balanceLcy: masked
          ? hidden("customer.balanceLcy", "role")
          : shown("customer.balanceLcy", "34107.09"),
        openOrders: [],
        overdueOrders: [
          {
            orderNo: "SO-0024",
            externalDocumentNo: "PO-IN-4261",
            daysOverdue: 11,
            step: "Bill of lading",
            dueDate: "2026-10-22",
          },
        ],
      },
      meta: { mock: true },
    }) as MasterDataCustomer200;

  it("says what is late in a sentence, with the date as every page writes it", async () => {
    await load();
    server.use(getMasterDataCustomerMockHandler(customer(false)));
    renderAt("/master-data/customers/C-0003");
    expect(
      await screen.findByText("Bill of lading, due 22 Oct 2026"),
    ).toBeVisible();
    expect(screen.queryByText(/2026-10-22/)).toBeNull();
  });

  it("hides the credit limit and balance from a role that never prices", async () => {
    await load();
    server.use(getMasterDataCustomerMockHandler(customer(true)));
    const view = renderAt("/master-data/customers/C-0003");
    await screen.findByRole("heading", { name: "C-0003" });
    expect(screen.queryByText(/108,000/)).toBeNull();
    expect(screen.getAllByRole("img", { name: "Hidden" })).toHaveLength(2);
    expect(await axeViolations(view.container)).toEqual([]);
  });
});
