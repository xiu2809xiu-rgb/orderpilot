import { fireEvent, screen, waitFor, within } from "@testing-library/react";
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
import { sessionFor } from "@/test/fixtures";
import OrdersScreen from "./OrdersScreen";
import {
  loadNamespaces,
  LocationProbe,
  manySpecs,
  nth,
  renderAt,
  stubApi,
  stubWindow,
} from "./ordersTestKit";

// The list's fit, its page past the end, its date range and its narrow
// windows: the faults the checks of 20 Nov found, held in place.

const open = (query = "") =>
  renderAt(
    <>
      <OrdersScreen />
      <LocationProbe />
    </>,
    `/orders${query}`,
  );

const heads = () =>
  within(nth(screen.getAllByRole("table"), 0))
    .getAllByRole("columnheader")
    .map((head) => head.textContent.trim());

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

describe("a page number past the end", () => {
  it("opens the last page, says so in the count, and rewrites the address", async () => {
    stubApi({ specs: manySpecs(12) });
    open("?page=99&size=10");
    expect(await screen.findByText("Page 2 of 2")).toBeVisible();
    expect(screen.getByText("Showing 11 to 12 of 12")).toBeVisible();
    expect(await bodyRows()).toHaveLength(2);
    expect(screen.queryByText(/Page 99/)).toBeNull();
    expect(screen.queryByText("No orders yet")).toBeNull();
    await waitFor(() => {
      const address = new URLSearchParams(
        screen.getByTestId("address").textContent,
      );
      expect(address.get("page")).toBe("2");
    });
  });

  it("drops the page from the address when the filters leave a single page", async () => {
    stubApi({ specs: manySpecs(12) });
    open("?page=99&size=10&q=SO-1000");
    expect(await screen.findByText("Page 1 of 1")).toBeVisible();
    await waitFor(() => {
      expect(screen.getByTestId("address").textContent).not.toContain("page=");
    });
  });
});

describe("the PO number", () => {
  it("is a column of the default view, so a search by PO shows its match", async () => {
    stubApi();
    open("?q=PO-SO-0002");
    const rows = await bodyRows();
    expect(rows).toHaveLength(1);
    expect(heads()).toContain("PO number");
    expect(within(nth(rows, 0)).getByText("PO-SO-0002")).toBeVisible();
  });
});

describe("the date range", () => {
  const reversed = "?from=2026-11-10&to=2026-11-01";

  it("says at the field that From is after To, and filters nothing", async () => {
    stubApi();
    const user = userEvent.setup();
    open(reversed);
    expect(await bodyRows()).toHaveLength(4);
    await user.click(screen.getByRole("button", { name: /More filters/ }));
    const message = await screen.findByRole("alert");
    expect(message).toHaveTextContent("From is after To");
    const from = screen.getByLabelText("From");
    const to = screen.getByLabelText("To");
    for (const field of [from, to]) {
      expect(field).toHaveAttribute("aria-invalid", "true");
      expect(field).toHaveAccessibleDescription(/From is after To/);
    }
    expect(screen.queryByText(/days? in range/)).toBeNull();
    // Not in force: no chip says the list is narrowed by it.
    expect(screen.queryByText(/^Ordered /)).toBeNull();
  });

  it("says it on the closed More filters button, tied to it, until the dates are in order", async () => {
    stubApi();
    const user = userEvent.setup();
    open(reversed);
    await bodyRows();
    const button = screen.getByRole("button", { name: /More filters/ });
    // Closed: no popover, and still a word on the control and for a screen reader.
    expect(screen.queryByLabelText("From")).toBeNull();
    expect(screen.getByText("Dates not in order")).toBeVisible();
    expect(button).toHaveAccessibleDescription("Dates not in order");
    await user.click(button);
    fireEvent.change(await screen.findByLabelText("From"), {
      target: { value: "2026-11-01" },
    });
    fireEvent.change(screen.getByLabelText("To"), {
      target: { value: "2026-11-10" },
    });
    expect(screen.queryByText("Dates not in order")).toBeNull();
    expect(button).not.toHaveAccessibleDescription();
  });

  it("says nothing on the button for a range in order", async () => {
    stubApi();
    open("?from=2026-11-01&to=2026-11-10");
    await bodyRows();
    expect(screen.queryByText("Dates not in order")).toBeNull();
  });

  it("filters again, and shows the span, once the dates are in order", async () => {
    stubApi();
    const user = userEvent.setup();
    open(reversed);
    await bodyRows();
    await user.click(screen.getByRole("button", { name: /More filters/ }));
    fireEvent.change(screen.getByLabelText("From"), {
      target: { value: "2026-11-01" },
    });
    fireEvent.change(screen.getByLabelText("To"), {
      target: { value: "2026-11-10" },
    });
    expect(await screen.findByText("10 days in range")).toBeVisible();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByLabelText("From")).not.toHaveAttribute("aria-invalid");
    // The picker holds each day to the other, so it cannot make a reversed range.
    expect(screen.getByLabelText("From")).toHaveAttribute("max", "2026-11-10");
    expect(screen.getByLabelText("To")).toHaveAttribute("min", "2026-11-01");
  });
});

describe("a narrow window", () => {
  it.each([
    [820, true],
    [390, true],
  ])(
    "at %i px leaves out what does not fit and keeps its facts under the number",
    async (width, coarse) => {
      stubWindow(width, coarse);
      stubApi();
      open();
      const rows = await bodyRows();
      const names = heads();
      for (const left of ["PO number", "Held at", "Ship date", "Value"]) {
        expect(names).not.toContain(left);
      }
      const first = nth(rows, 0);
      expect(within(first).getByText("PO-SO-0001")).toBeVisible();
      expect(within(first).getByText("Held at Finance")).toBeVisible();
      expect(within(first).getByText(/Ships /)).toBeVisible();
      expect(within(first).getByText("7,960.80")).toBeVisible();
    },
  );

  it("at 820 px keeps the Documents column, and at 390 px folds it too", async () => {
    stubWindow(820, true);
    stubApi();
    const wide = open();
    await bodyRows();
    expect(heads()).toContain("Documents");
    wide.unmount();
    stubWindow(390, true);
    open();
    await bodyRows();
    expect(heads()).not.toContain("Documents");
  });

  it("can reach all four tabs at 390 px", async () => {
    stubWindow(390, true);
    stubApi();
    open();
    await bodyRows();
    const tabs = screen.getByRole("tablist", { name: "Views" });
    expect(
      within(tabs)
        .getAllByRole("tab")
        .map((tab) => tab.textContent.replace(/\d+/g, "").trim()),
    ).toEqual(["All", "Needs me", "Held up", "By stage"]);
  });

  it("keeps the nine dots for a window of 1440 px or more, and drops them below", async () => {
    stubWindow(1536);
    stubApi();
    const wide = open();
    await bodyRows();
    expect(
      screen.getAllByRole("list", { name: "Sales order journey" }).length,
    ).toBeGreaterThan(0);
    wide.unmount();
    stubWindow(1366);
    open();
    await bodyRows();
    expect(
      screen.queryByRole("list", { name: "Sales order journey" }),
    ).toBeNull();
    // Every default column is still there at 1366 px.
    expect(heads()).toEqual(
      expect.arrayContaining([
        "PO number",
        "Held at",
        "Ship date",
        "Value",
        "Documents",
      ]),
    );
  });
});

describe("the held reason in a row", () => {
  it("says nothing about a payment under the stage, which the row's data cannot support", async () => {
    stubApi();
    open("?view=held");
    const rows = await bodyRows();
    expect(within(nth(rows, 0)).getByText(/Waiting for payment/)).toBeVisible();
    expect(
      within(nth(rows, 0)).queryByText("Payment not confirmed"),
    ).toBeNull();
  });
});
