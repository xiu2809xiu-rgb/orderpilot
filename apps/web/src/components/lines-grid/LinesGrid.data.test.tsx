import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import i18n from "@/i18n";
import { ApiError } from "@/lib/api/errors";
import { useToastStore } from "@/components/common/toast";
import { axeViolations } from "@/test/axe";
import { must } from "@/test/must";
import type { ItemOption, ItemSearch } from "./types";
import { ITEMS, line, renderGrid, SAVED, signInAs } from "./linesHarness";

beforeAll(async () => {
  await i18n.loadNamespaces(["form", "linesGrid", "components"]);
});

beforeEach(() => {
  localStorage.clear();
  useToastStore.setState({ items: [] });
  signInAs("SUPPORT");
});

const item = (n: number) =>
  screen.findByRole("combobox", { name: `Item, line ${String(n)}` });
const box = (label: string, n: number) =>
  screen.getByRole("textbox", { name: `${label}, line ${String(n)}` });
const save = () => screen.getByRole("button", { name: /^Save/ });
const footer = () => must(screen.getByText("Total").closest("dl"));

/** A search whose answers the test hands out, one call at a time. */
function controlled() {
  const calls: {
    query: string;
    signal: AbortSignal;
    answer: (options: readonly ItemOption[]) => void;
  }[] = [];
  const search: ItemSearch = (query, signal) =>
    new Promise((resolve) => {
      calls.push({ query, signal, answer: resolve });
    });
  return { search, calls };
}

describe("the item lookup in a line", () => {
  it("ignores a slow answer that arrives after a newer one", async () => {
    const user = userEvent.setup();
    const { search, calls } = controlled();
    renderGrid({ searchItems: search });
    await user.type(await item(1), "key");
    await waitFor(() => {
      expect(calls.length).toBeGreaterThan(1);
    });
    const [first, ...rest] = calls;
    rest.at(-1)?.answer([must(ITEMS[0])]);
    expect(
      await screen.findByRole("option", { name: /Norvale Wireless Mouse/ }),
    ).toBeVisible();
    // The first search was cancelled when the next one began: its answer is lost.
    expect(first?.signal.aborted).toBe(true);
    first?.answer([must(ITEMS[1])]);
    await Promise.resolve();
    expect(screen.queryByRole("option", { name: /Wired Keyboard/ })).toBeNull();
  });

  it("shows the number with the name in the list", async () => {
    const user = userEvent.setup();
    renderGrid();
    await user.type(await item(1), "norvale");
    const options = await screen.findAllByRole("option");
    expect(options[0]).toHaveTextContent("I-0001");
    expect(options[0]).toHaveTextContent("Norvale Wireless Mouse");
  });

  it("resolves a pasted part number on Enter", async () => {
    const user = userEvent.setup();
    renderGrid();
    await user.click(await item(1));
    await user.paste("nv-wk-200");
    await user.keyboard("{Enter}");
    await waitFor(() => {
      expect(box("Quantity", 1)).toHaveFocus();
    });
    expect(await item(1)).toHaveValue("I-0002  Norvale Wired Keyboard");
    expect(box("Unit price", 1)).toHaveValue("24.90");
  });

  it("keeps an unknown number visible, flags it, and refuses to save", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn(() => Promise.resolve());
    renderGrid({ onSave });
    const field = await item(1);
    await user.type(field, "ZZ-999{Enter}");
    expect(
      await screen.findByText(
        'No item matches "ZZ-999". Check the part number.',
      ),
    ).toBeVisible();
    expect(field).toHaveValue("ZZ-999");
    expect(field).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByText("This line has an error.")).toBeInTheDocument();
    await user.click(save());
    expect(onSave).not.toHaveBeenCalled();
  });

  it("sends the Navision number of the item, never its name", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn((values: unknown) => Promise.resolve(values));
    renderGrid({ onSave });
    await user.type(await item(1), "I-0001{Enter}");
    await user.keyboard("2");
    await user.click(save());
    await waitFor(() => {
      expect(onSave).toHaveBeenCalled();
    });
    expect(onSave.mock.calls[0]?.[0]).toMatchObject({
      lines: [
        { item: { number: "I-0001" }, quantity: "2", unitPrice: "18.40" },
      ],
    });
  });
});

describe("amounts and totals", () => {
  it("works 3 times 19.99 out exactly, in each line and in the footer", async () => {
    renderGrid({ lines: SAVED });
    await screen.findByRole("table");
    expect(screen.getByText("USD 59.97")).toBeVisible();
    expect(screen.getByText("USD 298.80")).toBeVisible();
    const totals = within(footer());
    expect(totals.getByText("USD 358.77")).toBeVisible();
    expect(totals.getByText("Quantity").nextSibling).toHaveTextContent("15");
  });

  it("updates as you type, and blanks an amount that is half typed", async () => {
    const user = userEvent.setup();
    renderGrid({ lines: SAVED });
    await screen.findByRole("table");
    const quantity = box("Quantity", 1);
    await user.clear(quantity);
    await user.type(quantity, "7");
    expect(screen.getByText("USD 139.93")).toBeVisible();
    expect(within(footer()).getByText("USD 438.73")).toBeVisible();
    await user.type(quantity, ".");
    expect(screen.queryByText("USD 139.93")).toBeNull();
    expect(within(footer()).getByText("USD 298.80")).toBeVisible();
  });

  it("shows the server's totals until a line changes", async () => {
    const user = userEvent.setup();
    const serverTotals = { quantity: "15", amount: "358.78" };
    renderGrid({ lines: SAVED, serverTotals });
    await screen.findByRole("table");
    expect(screen.getByText("USD 358.78")).toBeVisible();
    await user.type(box("Quantity", 1), "0");
    expect(screen.queryByText("USD 358.78")).toBeNull();
  });
});

describe("stock", () => {
  it("says what is needed, what is available and how short, and still saves", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn(() => Promise.resolve());
    renderGrid({
      lines: SAVED,
      onSave,
      shortfallAction: (short) => (
        <button type="button">Raise SPR for {short.itemNo}</button>
      ),
    });
    await screen.findByRole("table");
    expect(screen.getByText("Short by 4")).toBeVisible();
    expect(screen.getByText("Needs 12, 8 PCS available")).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Raise SPR for I-0002" }),
    ).toBeVisible();
    expect(screen.getByText("40 PCS available")).toBeVisible();
    await user.type(box("Quantity", 1), "1");
    await user.click(save());
    await waitFor(() => {
      expect(onSave).toHaveBeenCalled();
    });
  });

  it("says nothing is known for an item the API gave no stock for", async () => {
    renderGrid({
      lines: [
        line({ item: { number: "I-0001", name: "Norvale Wireless Mouse" } }),
      ],
    });
    expect(await screen.findByText("Not known")).toBeVisible();
  });
});

describe("errors from the server", () => {
  it("puts an error on lines.1.quantity in that cell and focuses it", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn(() =>
      Promise.reject(
        new ApiError("VALIDATION_FAILED", "Not valid.", 400, "trace-1", [
          { path: "lines.1.quantity", message: "Only 8 are on hand." },
        ]),
      ),
    );
    renderGrid({ lines: SAVED, onSave });
    await screen.findByRole("table");
    await user.type(box("Quantity", 1), "0");
    await user.click(save());
    expect(await screen.findByText("Only 8 are on hand.")).toBeVisible();
    expect(box("Quantity", 2)).toHaveFocus();
    expect(box("Quantity", 2)).toHaveAttribute("aria-invalid", "true");
    const second = screen.getByRole("row", { name: "Line 2" });
    expect(
      within(second).getByText("This line has an error."),
    ).toBeInTheDocument();
    const first = screen.getByRole("row", { name: "Line 1" });
    expect(within(first).queryByText("This line has an error.")).toBeNull();
  });

  it("marks the line when a cell fails its own check", async () => {
    const user = userEvent.setup();
    renderGrid({ lines: SAVED });
    await screen.findByRole("table");
    const quantity = box("Quantity", 1);
    await user.clear(quantity);
    await user.tab();
    expect(await screen.findByText("Enter a quantity.")).toBeVisible();
    expect(
      within(screen.getByRole("row", { name: "Line 1" })).getByText(
        "This line has an error.",
      ),
    ).toBeInTheDocument();
  });
});

describe("a grid with nothing to edit", () => {
  it("draws a saved record as text, with no inputs and no buttons", async () => {
    renderGrid({ lines: SAVED, readOnly: true });
    const table = await screen.findByRole("table", { name: "Order lines" });
    expect(within(table).queryAllByRole("textbox")).toHaveLength(0);
    expect(within(table).queryAllByRole("combobox")).toHaveLength(0);
    expect(
      screen.queryByRole("button", { name: /Remove|Add line/ }),
    ).toBeNull();
    expect(within(table).getAllByText("Norvale Wired Keyboard")).toHaveLength(
      2,
    );
    expect(within(table).getAllByRole("columnheader")).toHaveLength(7);
    expect(await axeViolations(document.body)).toEqual([]);
  });

  it("shows the mask and its reason, and keeps every amount behind it", async () => {
    const user = userEvent.setup();
    renderGrid({
      lines: SAVED.map((l) => ({ ...l, unitPrice: "" })),
      readOnly: true,
      priceMask: { reason: "price", visibleTo: "Support and Finance" },
    });
    const table = await screen.findByRole("table");
    // A mask for each price, one for each amount, and one for the total.
    expect(screen.getAllByRole("img", { name: "Hidden" })).toHaveLength(5);
    const why = within(table).getAllByRole("button", {
      name: "Why is this hidden?",
    });
    await user.click(must(why[0]));
    expect(
      await screen.findByText(
        "Prices are hidden unless your role works with pricing.",
      ),
    ).toBeVisible();
    expect(
      screen.getByText("Who can see it: Support and Finance"),
    ).toBeVisible();
    expect(document.body.textContent).not.toMatch(
      /USD \d|19\.99|24\.90|59\.97|298\.80|358/,
    );
  });
});
