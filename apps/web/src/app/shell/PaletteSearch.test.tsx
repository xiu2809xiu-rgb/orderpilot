import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { useRecordTabs } from "@/stores/recordTabs";
import { axeViolations } from "@/test/axe";
import {
  customerRow,
  itemRow,
  loadPaletteWords,
  openPalette,
  orderRow,
  resetPalette,
  serve,
  vendorRow,
} from "./paletteTestKit";

beforeAll(loadPaletteWords);
afterEach(resetPalette);

const everything = () =>
  serve({
    orders: [orderRow("SO-0082", "Meridian Vale Technologies", "4471-26")],
    customers: [customerRow("C-1042", "Meridian Vale Technologies")],
    vendors: [vendorRow("V-0007", "Pelagia Source Co")],
    items: [itemRow("I-0025", "HP Monitor 24-inch")],
  });

const box = () => screen.findByRole("combobox");
const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** The headings of the groups on screen, top to bottom. */
const headings = () =>
  screen
    .getAllByRole("group")
    .map((group) => group.getAttribute("aria-labelledby"))
    .map((id) => (id ? document.getElementById(id)?.textContent : null));

describe("searching the records from the palette", () => {
  it("finds an order by its number, shows its PO number and stage, and Enter opens it", async () => {
    const served = everything();
    openPalette();
    await userEvent.type(await box(), "SO-0082");
    const row = await screen.findByRole("option", { name: /Order SO-0082/ });
    expect(row).toHaveTextContent("Meridian Vale Technologies");
    expect(row).toHaveTextContent("PO 4471-26");
    expect(row).toHaveTextContent("Short on stock");
    expect(row).not.toHaveTextContent("100.00");
    expect(served.calls.orders.at(-1)).toContain("search=SO-0082");
    await userEvent.keyboard("{Enter}");
    expect(screen.getByTestId("where")).toHaveTextContent("/orders/SO-0082");
  });

  it("lists the groups in the order Orders, Customers, Vendors, Items, then pages", async () => {
    everything();
    openPalette();
    await userEvent.type(await box(), "Meridian");
    await screen.findByRole("option", { name: /Item I-0025/ });
    expect(headings().slice(0, 4)).toEqual([
      "Orders",
      "Customers",
      "Vendors",
      "Items",
    ]);
  });

  it("finds a customer by name and opens its page", async () => {
    everything();
    openPalette();
    await userEvent.type(await box(), "Meridian");
    const group = within(
      await screen.findByRole("group", { name: "Customers" }),
    );
    await userEvent.click(
      group.getByRole("option", { name: /Customer C-1042/ }),
    );
    expect(screen.getByTestId("where")).toHaveTextContent(
      "/master-data/customers/C-1042",
    );
  });

  it("finds a vendor by its number and opens its page", async () => {
    everything();
    openPalette();
    await userEvent.type(await box(), "V-0007");
    await userEvent.click(
      await screen.findByRole("option", { name: /Vendor V-0007/ }),
    );
    expect(screen.getByTestId("where")).toHaveTextContent(
      "/master-data/vendors/V-0007",
    );
  });

  it("finds an item by its name and opens its page", async () => {
    everything();
    openPalette();
    await userEvent.type(await box(), "HP monitor");
    await userEvent.click(
      await screen.findByRole("option", { name: /Item I-0025, HP Monitor/ }),
    );
    expect(screen.getByTestId("where")).toHaveTextContent(
      "/master-data/items/I-0025",
    );
  });

  it("sends no request for one character or for spaces", async () => {
    const served = everything();
    openPalette();
    await userEvent.type(await box(), "S");
    await userEvent.type(await box(), "   ");
    await pause(400);
    expect(Object.values(served.calls).flat()).toEqual([]);
    expect(screen.queryByRole("option", { name: /Order SO/ })).toBeNull();
  });

  it("ignores the spaces around the query", async () => {
    const served = everything();
    openPalette();
    await userEvent.type(await box(), "  SO-0082  ");
    await screen.findByRole("option", { name: /Order SO-0082/ });
    expect(
      served.calls.orders.every((q) => /search=SO-0082(&|$)/.test(q)),
    ).toBe(true);
  });

  it("asks only for what the role may read, and a role that reads none gets pages only", async () => {
    const served = everything();
    openPalette("SYSTEM_ADMIN");
    await userEvent.type(await box(), "Meridian");
    await pause(400);
    expect(Object.values(served.calls).flat()).toEqual([]);
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.queryByRole("group", { name: "Orders" })).toBeNull();
  });

  it("says what was searched when nothing matches, and offers no retry", async () => {
    serve({});
    openPalette();
    await userEvent.type(await box(), "zzqq");
    expect(
      await screen.findByText(
        'No order, customer, vendor or item matches "zzqq". Try an order or PO number.',
        { selector: "p" },
      ),
    ).toBeInTheDocument();
    // A screen reader hears the same words from the polite status line.
    expect(screen.getByRole("status")).toHaveTextContent(
      'No order, customer, vendor or item matches "zzqq".',
    );
    expect(screen.queryByRole("button", { name: "Retry" })).toBeNull();
  });

  it("shows a quiet searching row while the first answer is on its way", async () => {
    serve({});
    openPalette();
    await userEvent.type(await box(), "zzqq");
    expect(
      screen.getByText(/^Searching orders/, { selector: "p" }),
    ).toBeInTheDocument();
  });

  it("names the trace id on a failure, keeps the other results, and Retry asks again", async () => {
    const served = everything();
    served.failing.add("vendors");
    openPalette();
    await userEvent.type(await box(), "Meridian");
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Trace id trace-search-1");
    expect(
      screen.getByRole("option", { name: /Customer C-1042/ }),
    ).toBeInTheDocument();
    const before = served.calls.vendors.length;
    served.failing.delete("vendors");
    await userEvent.click(within(alert).getByRole("button", { name: "Retry" }));
    await waitFor(() => {
      expect(screen.queryByRole("alert")).toBeNull();
    });
    expect(served.calls.vendors.length).toBe(before + 1);
    expect(
      await screen.findByRole("option", { name: /Vendor V-0007/ }),
    ).toBeInTheDocument();
  });

  it("announces the number of results politely", async () => {
    everything();
    openPalette();
    await userEvent.type(await box(), "Meridian");
    await screen.findByRole("option", { name: /Order SO-0082/ });
    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent(/^\d+ results$/);
    });
  });

  it("highlights the first row, moves with the arrow keys, and opens the highlighted row", async () => {
    everything();
    openPalette();
    await userEvent.type(await box(), "Meridian");
    await screen.findByRole("option", { name: /Customer C-1042/ });
    expect(screen.getAllByRole("option")[0]).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await userEvent.keyboard("{ArrowDown}{Enter}");
    expect(screen.getByTestId("where")).toHaveTextContent(
      "/master-data/customers/C-1042",
    );
  });

  it("has no accessibility violations with results, a failure and nothing found", async () => {
    const served = everything();
    served.failing.add("vendors");
    openPalette();
    await userEvent.type(await box(), "Meridian");
    await screen.findByRole("alert");
    expect(await axeViolations(document.body)).toEqual([]);
    await userEvent.clear(await box());
    await userEvent.type(await box(), "SO-0082");
    await screen.findByRole("option", { name: /Order SO-0082/ });
    expect(await axeViolations(document.body)).toEqual([]);
  });

  it("matches pages and actions by word, not by scattered letters", async () => {
    serve({});
    openPalette("MANAGEMENT");
    await userEvent.type(await box(), "kpi");
    await pause(300);
    expect(
      screen.queryByRole("option", { name: "Use the dark theme" }),
    ).toBeNull();
  });
});

describe("the palette with nothing typed", () => {
  it("lists the records opened lately first, then pages, then actions with the theme and Sign out last", async () => {
    serve({});
    useRecordTabs.setState({
      owner: "op.tabs.test",
      tabs: [
        {
          key: "/orders/SO-0001",
          kind: "order",
          no: "SO-0001",
          listPath: "/orders",
          to: "/orders/SO-0001",
          dirty: false,
        },
        {
          key: "/master-data/customers/C-1042",
          kind: "customer",
          no: "C-1042",
          listPath: "/master-data/customers",
          to: "/master-data/customers/C-1042",
          dirty: false,
        },
      ],
    });
    openPalette("SUPPORT");
    await box();
    // The demo tools of the top bar have a group of their own, after the
    // places and before the actions: "Go to" is the menu and nothing else.
    expect(headings()).toEqual(["Opened lately", "Go to", "Demo", "Actions"]);
    const recent = within(
      screen.getByRole("group", { name: "Opened lately" }),
    ).getAllByRole("option");
    expect(recent.map((o) => o.getAttribute("aria-label"))).toEqual([
      "Customer C-1042",
      "Order SO-0001",
    ]);
    const actions = within(
      screen.getByRole("group", { name: "Actions" }),
    ).getAllByRole("option");
    expect(actions.slice(-3).map((o) => o.textContent)).toEqual([
      "Use the light theme",
      "Use the dark theme",
      "Sign out",
    ]);
  });

  it("shows no recent group when no record is open, and lists no entry twice", async () => {
    serve({});
    openPalette("SUPPORT");
    await box();
    expect(screen.queryByRole("group", { name: "Opened lately" })).toBeNull();
    const labels = screen.getAllByRole("option").map((o) => o.textContent);
    expect(labels.filter((label) => label === "Customers")).toHaveLength(1);
    expect(labels.filter((label) => label === "Vendors")).toHaveLength(1);
  });
});
