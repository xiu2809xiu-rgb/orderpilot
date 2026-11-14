import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Role } from "@orderpilot/shared";
import { useLocation } from "react-router";
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { useGlobalShortcuts } from "@/app/shell/shortcuts";
import { useSessionStore } from "@/stores/session";
import { axeViolations } from "@/test/axe";
import { sessionFor } from "@/test/fixtures";
import OrdersScreen from "./OrdersScreen";
import {
  loadNamespaces,
  nth,
  renderAt,
  SPECS,
  stubApi,
  type OrderSpec,
} from "./ordersTestKit";

// What the old Orders list did, held to the workspace that replaced it. Each
// test is the old list's own, moved over; the workspace reads the same API
// and works the rows out in the browser, so a filter in the address is read
// here, not sent to the server.

const HERE = "here";

/** Draws where the router is, and turns on the slash and N keys as the shell does. */
function Probe() {
  useGlobalShortcuts();
  const { pathname, search } = useLocation();
  return <output aria-label={HERE}>{`${pathname}${search}`}</output>;
}

function open(path = "/orders", role: Role = "SUPPORT") {
  useSessionStore.setState({ status: "active", session: sessionFor(role) });
  return renderAt(
    <>
      <Probe />
      <OrdersScreen />
    </>,
    path,
  );
}

const here = () => screen.getByLabelText(HERE).textContent;

/** The sort button in a column's heading. */
const sortButton = (column: string) =>
  within(screen.getByRole("columnheader", { name: column })).getByRole(
    "button",
  );

/** The table's body rows, once the orders have arrived. */
async function bodyRows(): Promise<HTMLElement[]> {
  await screen.findAllByRole("link", { name: /^SO-[\w-]+$/ });
  return within(nth(screen.getAllByRole("table"), 0))
    .getAllByRole("row")
    .slice(1);
}

const orderNos = (rows: readonly HTMLElement[]) =>
  rows.map((row) => within(row).getAllByRole("link")[0]?.textContent);

const draft: OrderSpec = {
  ...nth(SPECS, 0),
  orderNo: "SO-20261108-0001",
  entered: "draft",
  shortBy: "6.00",
  shortItems: 3,
  orderedDaysAgo: 2,
};
const entered = (
  orderNo: string,
  state: "submitted" | "void",
  orderedDaysAgo: number,
): OrderSpec => ({ ...draft, orderNo, entered: state, orderedDaysAgo });

/** Thirty orders, so the list has a second page. */
const MANY: OrderSpec[] = Array.from({ length: 30 }, (_, index) => ({
  ...nth(SPECS, 1),
  orderNo: `SO-${String(1000 + index)}`,
  orderedDaysAgo: index + 1,
}));

beforeAll(loadNamespaces);

beforeEach(() => {
  useSessionStore.setState({
    status: "active",
    session: sessionFor("SUPPORT"),
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("the Orders workspace keeps what the old list gave", () => {
  it("links every order to its own page, tags an order entered here, and labels the data", async () => {
    stubApi({ specs: [nth(SPECS, 0), draft] });
    const view = open();
    await bodyRows();
    expect(screen.getByRole("link", { name: "SO-0001" })).toHaveAttribute(
      "href",
      "/orders/SO-0001",
    );
    expect(
      screen.getByRole("link", { name: "SO-20261108-0001" }),
    ).toHaveAttribute("href", "/orders/SO-20261108-0001");
    const table = within(screen.getByRole("table"));
    expect(table.getByText("Draft")).toBeVisible();
    // A sample carries no tag; the Source filter and column say so.
    expect(table.queryByText("Sample")).toBeNull();
    expect(screen.getByText("Synthetic demo data")).toBeVisible();
    expect(screen.getByRole("link", { name: "New order" })).toBeVisible();
    expect(await axeViolations(view.container)).toEqual([]);
  });

  it("draws a Submitted order in the neutral chip and a Void one struck through, never as approved", async () => {
    stubApi({
      specs: [
        nth(SPECS, 0),
        entered("SO-20261108-0002", "submitted", 3),
        entered("SO-20261108-0003", "void", 4),
      ],
    });
    open();
    await bodyRows();
    const table = within(screen.getByRole("table"));
    const submitted = table.getByText("Submitted").closest("[data-entry]");
    expect(submitted).toHaveAttribute("data-entry", "submitted");
    expect(submitted?.className).not.toContain("info");
    const voided = table.getByText("Void").closest("[data-entry]");
    expect(voided).toHaveAttribute("data-entry", "void");
    expect(voided?.className).toContain("line-through");
    expect(voided?.className).not.toContain("success");
  });

  it("says by how much an order is short and of how many items, and offers no button to order", async () => {
    stubApi({ specs: [draft] });
    const user = userEvent.setup();
    open();
    await bodyRows();
    await user.click(screen.getByRole("button", { name: "Columns" }));
    await user.click(screen.getByRole("checkbox", { name: "Stock" }));
    expect(await screen.findByText("Short 6")).toBeVisible();
    // On the screen itself, not only in a tooltip a keyboard cannot reach.
    expect(screen.getByText("I-0190 and 2 more")).toBeVisible();
    expect(
      screen.queryByRole("button", { name: /order stock|raise|purchase/i }),
    ).toBeNull();
  });

  it("shows the amount as dots with the reason for a role that may not see amounts, and sends no amount sort", async () => {
    stubApi({ masked: true });
    open("/orders?sort=amount&direction=desc", "WAREHOUSE");
    const rows = await bodyRows();
    expect(screen.queryByText(/7,960/)).toBeNull();
    expect(
      screen.getAllByText(/prices are for roles that work with pricing/).length,
    ).toBeGreaterThan(0);
    const value = screen.getByRole("columnheader", { name: "Value" });
    expect(value).not.toHaveAttribute("aria-sort", "descending");
    expect(within(value).queryByRole("button")).toBeNull();
    // The tracker's own order, the most overdue first, not the hidden figures'.
    expect(orderNos(rows)[0]).toBe("SO-0001");
  });

  it("sorts by a column and says so in the address, and by the entry state", async () => {
    stubApi({
      specs: [
        nth(SPECS, 0),
        entered("SO-20261108-0002", "submitted", 3),
        draft,
      ],
    });
    const user = userEvent.setup();
    open();
    await bodyRows();
    await user.click(sortButton("Order"));
    await waitFor(() => {
      expect(here()).toContain("sort=orderNo&dir=asc");
    });
    expect(orderNos(await bodyRows())).toEqual([
      "SO-0001",
      "SO-20261108-0001",
      "SO-20261108-0002",
    ]);
    await user.click(sortButton("Order"));
    await waitFor(() => {
      expect(here()).toContain("dir=desc");
    });
    await user.click(screen.getByRole("button", { name: "Columns" }));
    await user.click(screen.getByRole("checkbox", { name: "Entry" }));
    await user.click(sortButton("Entry"));
    await waitFor(() => {
      expect(here()).toContain("sort=entry&dir=asc");
    });
    // Draft before Submitted; an order with no entry state, a sample, last.
    expect(orderNos(await bodyRows())).toEqual([
      "SO-20261108-0001",
      "SO-20261108-0002",
      "SO-0001",
    ]);
  });

  it("pages through the list, at a page size the person chooses, and keeps both in the address", async () => {
    stubApi({ specs: MANY });
    const user = userEvent.setup();
    open();
    expect(await bodyRows()).toHaveLength(25);
    expect(screen.getByText("Showing 1 to 25 of 30")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Next page" }));
    expect(await screen.findByText("Showing 26 to 30 of 30")).toBeVisible();
    expect(here()).toContain("page=2");
    expect(await bodyRows()).toHaveLength(5);
    await user.selectOptions(screen.getByLabelText("Rows per page"), "10");
    await waitFor(() => {
      expect(here()).toContain("size=10");
    });
    expect(here()).not.toContain("page=");
    expect(await bodyRows()).toHaveLength(10);
  });

  it("opens the same list from an address with a page, a size and a sort", async () => {
    stubApi({ specs: MANY });
    open("/orders?page=2&size=10&sort=orderNo&dir=desc");
    const rows = await bodyRows();
    expect(rows).toHaveLength(10);
    expect(orderNos(rows)[0]).toBe("SO-1019");
    expect(screen.getByText("Showing 11 to 20 of 30")).toBeVisible();
  });

  it("opens from the addresses the old list made, and rewrites them when a filter changes", async () => {
    stubApi({
      specs: [
        nth(SPECS, 0),
        nth(SPECS, 1),
        { ...draft, customerNo: "C-0002", customerName: "Beta Stores" },
        entered("SO-20261108-0002", "submitted", 3),
      ],
    });
    const user = userEvent.setup();
    open(
      "/orders?customerNo=C-0002&captureState=draft&source=stored&orderDateFrom=2020-01-01&orderDateTo=2099-01-01&search=SO-2026&direction=desc",
    );
    expect(orderNos(await bodyRows())).toEqual(["SO-20261108-0001"]);
    const chips = screen.getByRole("list", { name: "Filters in force" });
    expect(within(chips).getByText("Customer: Beta Stores")).toBeVisible();
    expect(within(chips).getByText("Entry: Draft")).toBeVisible();
    await user.click(
      within(chips).getByRole("button", {
        name: "Remove filter: Customer: Beta Stores",
      }),
    );
    // The old name is gone from the address, or the customer would come back.
    await waitFor(() => {
      expect(here()).not.toContain("customerNo");
    });
    expect(here()).toContain("entry=draft");
    expect(here()).not.toContain("customer=");
  });

  it("filters to the orders that wait on stock, and drops a free-text value of that filter", async () => {
    stubApi({ specs: [nth(SPECS, 0), draft] });
    const first = open("/orders?stock=waiting");
    expect(orderNos(await bodyRows())).toEqual(["SO-20261108-0001"]);
    expect(
      screen.getByRole("button", { name: "Waiting on stock", pressed: true }),
    ).toBeVisible();
    first.unmount();
    open("/orders?stock=true");
    expect(orderNos(await bodyRows())).toHaveLength(2);
  });

  it("shows what each order is short of as soon as Waiting on stock is on", async () => {
    stubApi({ specs: [nth(SPECS, 0), draft] });
    open("/orders?stock=waiting");
    await bodyRows();
    expect(screen.getByText("Short 6")).toBeVisible();
    expect(screen.getByText("I-0190 and 2 more")).toBeVisible();
  });

  it("filters by customer, picked by number from the orders' own customers", async () => {
    stubApi();
    const user = userEvent.setup();
    open();
    await bodyRows();
    await user.click(screen.getByRole("combobox", { name: "Customer" }));
    await user.click(
      await screen.findByRole("option", { name: /Beta Stores/ }),
    );
    expect(orderNos(await bodyRows())).toEqual(["SO-0002"]);
    expect(here()).toContain("customer=C-0002");
  });

  it("searches by order, PO number or customer, and the slash key goes to the search", async () => {
    stubApi();
    const user = userEvent.setup();
    open();
    await bodyRows();
    await user.keyboard("/");
    expect(screen.getByRole("searchbox")).toHaveFocus();
    await user.keyboard("Gamma");
    expect(await screen.findByText("Showing 1 to 1 of 1")).toBeVisible();
    expect(here()).toContain("q=Gamma");
    expect(orderNos(await bodyRows())).toEqual(["SO-0003"]);
  });

  it("offers Export and Print, and Saved views and Columns, beside the table", async () => {
    stubApi();
    open();
    await bodyRows();
    for (const name of ["Export", "Print", "Saved views", "Columns"]) {
      expect(screen.getByRole("button", { name })).toBeVisible();
    }
  });

  it("keeps Export and Print off until the orders have arrived, so neither takes an empty list", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => new Promise<Response>(() => undefined)),
    );
    const view = open();
    expect(screen.getByRole("button", { name: "Print" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Export" })).toBeDisabled();
    view.unmount();
    vi.unstubAllGlobals();
    stubApi();
    open();
    await bodyRows();
    expect(screen.getByRole("button", { name: "Print" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Export" })).toBeEnabled();
  });

  it("names the next step when there are no orders at all, and the filter's way back when none match", async () => {
    stubApi({ specs: [] });
    const first = open();
    expect(await screen.findByText("No orders yet")).toBeVisible();
    expect(screen.getByText(/Use New order, above/)).toBeVisible();
    first.unmount();
    stubApi();
    const user = userEvent.setup();
    open("/orders?source=stored");
    expect(await screen.findByText("No results match")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Clear all" }));
    expect(await bodyRows()).toHaveLength(SPECS.length);
  });

  it("does not say there are no orders when a view is empty", async () => {
    stubApi({ specs: [nth(SPECS, 1), nth(SPECS, 3)] });
    open("/orders?view=held");
    expect(await screen.findByText("No results match")).toBeVisible();
    expect(screen.queryByText("No orders yet")).toBeNull();
  });

  it("gives each order a row menu with its number in its name", async () => {
    stubApi({ specs: [nth(SPECS, 0), draft] });
    open();
    await bodyRows();
    expect(
      screen.getByRole("button", { name: "Actions for SO-0001" }),
    ).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Actions for SO-20261108-0001" }),
    ).toBeVisible();
  });

  it.each(["SUPPORT", "PRODUCT_MANAGER"] as const)(
    "gives %s one primary button, New order, and the N key goes to the form",
    async (role) => {
      stubApi();
      const user = userEvent.setup();
      const view = open("/orders", role);
      await bodyRows();
      const primary = view.container.querySelectorAll(
        'button[data-variant="default"], a[data-variant="default"]',
      );
      expect(primary).toHaveLength(1);
      expect(primary[0]).toHaveTextContent("New order");
      await user.keyboard("n");
      expect(here()).toBe("/orders/new");
    },
  );

  it.each(["WAREHOUSE", "AUDITOR"] as const)(
    "shows %s no New order button, and the N key does nothing",
    async (role) => {
      stubApi();
      const user = userEvent.setup();
      open("/orders", role);
      await bodyRows();
      expect(screen.queryByRole("link", { name: /^New/ })).toBeNull();
      await user.keyboard("n");
      expect(here()).toBe("/orders");
    },
  );

  it("says access is denied, with no filters, when the server refuses the list", async () => {
    stubApi({ ordersForbidden: true });
    open();
    expect(
      await screen.findByText("You do not have access to this"),
    ).toBeVisible();
    expect(screen.queryByRole("button", { name: "Export" })).toBeNull();
  });
});
