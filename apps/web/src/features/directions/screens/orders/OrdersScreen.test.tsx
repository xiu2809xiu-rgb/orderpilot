import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { useSessionStore } from "@/stores/session";
import { axeViolations } from "@/test/axe";
import { sessionFor } from "@/test/fixtures";
import OrdersScreen from "./OrdersScreen";
import { loadNamespaces, nth, renderAt, SPECS, stubApi } from "./ordersTestKit";

const open = (query = "") =>
  renderAt(<OrdersScreen />, `/preview/orders${query}`);

/** The table's rows, once the orders have arrived. */
async function bodyRows(): Promise<HTMLElement[]> {
  await screen.findAllByRole("link", { name: /^SO-\d+$/ });
  return within(nth(screen.getAllByRole("table"), 0))
    .getAllByRole("row")
    .slice(1);
}

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

describe("the Orders workspace", () => {
  it("holds every order in one table with the columns of both old pages", async () => {
    stubApi();
    open();
    const rows = await bodyRows();
    expect(rows).toHaveLength(SPECS.length);
    const table = nth(screen.getAllByRole("table"), 0);
    const heads = within(table)
      .getAllByRole("columnheader")
      .map((head) => head.textContent.trim());
    for (const name of [
      "Order",
      "Customer",
      "Stage",
      "Held at",
      "Order age",
      "Ship date",
      "Value",
      "Documents",
    ]) {
      expect(heads).toContain(name);
    }
    // The first order is the most overdue, as the tracker sorts them.
    expect(within(nth(rows, 0)).getByText("SO-0001")).toBeVisible();
    expect(within(nth(rows, 0)).getByText("3 d late")).toBeVisible();
    expect(
      within(nth(rows, 0)).getByRole("link", { name: "SO-0001" }),
    ).toHaveAttribute("href", "/preview/order?order=SO-0001");
  });

  it("puts the journey rail in each row, at the step the status belongs to", async () => {
    stubApi();
    open();
    const rows = await bodyRows();
    const rail = within(nth(rows, 0)).getByRole("list", {
      name: "Sales order journey",
    });
    const items = within(rail).getAllByRole("listitem");
    expect(items).toHaveLength(9);
    // Waiting for payment is the fourth step.
    expect(items[3]).toHaveAttribute("aria-current", "step");
    expect(items[2]).not.toHaveAttribute("aria-current");
  });

  it("counts the views under the filters and shows Needs me as the team's orders", async () => {
    stubApi();
    const user = userEvent.setup();
    open();
    await bodyRows();
    const tabs = screen.getByRole("tablist", { name: "Views" });
    expect(within(tabs).getByRole("tab", { name: /^All\s*4$/ })).toBeVisible();
    expect(
      within(tabs).getByRole("tab", { name: /^Needs me\s*1$/ }),
    ).toBeVisible();
    expect(
      within(tabs).getByRole("tab", { name: /^Held up\s*2$/ }),
    ).toBeVisible();
    await user.click(within(tabs).getByRole("tab", { name: /^Needs me/ }));
    const rows = await waitFor(async () => {
      const found = await bodyRows();
      expect(found).toHaveLength(1);
      return found;
    });
    expect(within(nth(rows, 0)).getByText("SO-0002")).toBeVisible();
  });

  it("lays the same orders out as a board of the nine steps and a last column", async () => {
    stubApi();
    open("?view=stage");
    await screen.findByRole("button", { name: "SO-0001" });
    const board = screen.getByRole("region", { name: "Orders by stage" });
    const columns = within(board).getAllByRole("region");
    expect(columns).toHaveLength(10);
    const payment = within(board).getByRole("region", {
      name: "Payment received",
    });
    expect(within(payment).getByText("SO-0001")).toBeVisible();
    const done = within(board).getByRole("region", { name: "Done" });
    expect(within(done).getByText("SO-0004")).toBeVisible();
    // A card opens the side peek; the number is its button.
    expect(
      within(payment).getByRole("button", { name: "SO-0001" }),
    ).toBeVisible();
  });

  it("narrows by every filter of the old pages and says what is on", async () => {
    stubApi({ toConfirm: ["SO-0002"] });
    const user = userEvent.setup();
    open();
    await bodyRows();
    await user.click(screen.getByRole("button", { name: "Past due" }));
    expect(await bodyRows()).toHaveLength(1);
    const chips = screen.getByRole("list", { name: "Filters in force" });
    expect(within(chips).getByText("Past due")).toBeVisible();
    await user.click(
      within(chips).getByRole("button", { name: "Remove filter: Past due" }),
    );
    expect(await bodyRows()).toHaveLength(4);
    await user.click(screen.getByRole("button", { name: "Has exceptions" }));
    expect(await bodyRows()).toHaveLength(1);
    await user.click(screen.getByRole("button", { name: "Has exceptions" }));
    await user.click(screen.getByRole("button", { name: /More filters/ }));
    await user.click(screen.getByRole("switch", { name: "Waiting on stock" }));
    expect(await bodyRows()).toHaveLength(1);
    await user.click(screen.getByRole("button", { name: "Clear all" }));
    expect(await bodyRows()).toHaveLength(4);
  });

  it("opens already filtered from the links the home screen and the tracker use", async () => {
    stubApi({ toConfirm: ["SO-0002"] });
    open("?step=pi&documentToConfirm=true");
    const rows = await bodyRows();
    expect(rows).toHaveLength(1);
    expect(within(nth(rows, 0)).getByText("SO-0002")).toBeVisible();
    expect(
      screen.getByRole("list", { name: "Filters in force" }),
    ).toHaveTextContent("Step: PI generated and sent");
  });

  it("hides prices from a role that may not see them, with the reason, and cannot sort by them", async () => {
    stubApi({ masked: true });
    open();
    await bodyRows();
    const body = document.body.textContent;
    expect(body).not.toContain("7,960.80");
    expect(body).not.toContain("7960.80");
    // The tracker also sends an amount; it is never the one shown.
    expect(screen.getAllByText("Hidden").length).toBeGreaterThan(0);
    expect(
      screen.getAllByText(/prices are for roles that work with pricing/).length,
    ).toBeGreaterThan(0);
    const value = screen.getByRole("columnheader", { name: "Value" });
    expect(within(value).queryByRole("button")).toBeNull();
  });

  it("leaves Needs me out for a role with no tasks", async () => {
    useSessionStore.setState({
      status: "active",
      session: sessionFor("MANAGEMENT"),
    });
    stubApi();
    open();
    await bodyRows();
    const tabs = screen.getByRole("tablist", { name: "Views" });
    expect(within(tabs).queryByRole("tab", { name: /Needs me/ })).toBeNull();
    expect(within(tabs).getAllByRole("tab")).toHaveLength(3);
  });

  it("offers New order as the one primary button and Upload a PO beside it", async () => {
    stubApi();
    open();
    await bodyRows();
    expect(screen.getByRole("link", { name: "New order" })).toHaveAttribute(
      "href",
      "/orders/new",
    );
    expect(screen.getByRole("link", { name: "Upload a PO" })).toHaveAttribute(
      "href",
      "/preview/upload",
    );
  });

  it("opens the side peek with the order's journey and steps through the list", async () => {
    stubApi();
    const user = userEvent.setup();
    open();
    const rows = await bodyRows();
    await user.click(within(nth(rows, 0)).getByText("Alpha Traders"));
    const peek = await screen.findByRole("dialog");
    expect(within(peek).getByText("SO-0001")).toBeVisible();
    expect(within(peek).getByText("1 of 4")).toBeVisible();
    expect(
      await within(peek).findByRole("list", { name: "Sales order journey" }),
    ).toBeVisible();
    expect(
      within(peek).getByRole("link", { name: /Open order/ }),
    ).toHaveAttribute("href", "/preview/order?order=SO-0001");
    await user.click(within(peek).getByRole("button", { name: "Next order" }));
    expect(await within(peek).findByText("2 of 4")).toBeVisible();
  });

  it("shows the error with its trace id and a way to retry", async () => {
    stubApi({ ordersFail: true });
    open();
    expect(await screen.findByText(/trace-123/)).toBeVisible();
    expect(screen.getByRole("button", { name: "Try again" })).toBeVisible();
  });

  it("shows only the refusal to a role that may not read orders, with nothing to filter", async () => {
    stubApi({ ordersForbidden: true });
    open();
    expect(
      await screen.findByText("You do not have access to this"),
    ).toBeVisible();
    expect(
      screen.getByRole("heading", { level: 1, name: "Orders" }),
    ).toBeVisible();
    expect(screen.queryByRole("tablist", { name: "Views" })).toBeNull();
    expect(screen.queryByLabelText("Search")).toBeNull();
    expect(screen.queryByRole("link", { name: "New order" })).toBeNull();
  });

  it("has no accessibility violations", async () => {
    stubApi();
    const view = open("");
    await bodyRows();
    expect(await axeViolations(view.container)).toEqual([]);
  });
});
