import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import i18n from "@/i18n";
import { useToastStore } from "@/components/common/toast";
import { line, renderGrid, SAVED, signInAs } from "./linesHarness";

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
const lines = () => document.querySelectorAll("[data-row]").length;

describe("the lines grid, from the keyboard", () => {
  it("is a table with a labelled input in every cell", async () => {
    renderGrid({ lines: SAVED });
    const table = await screen.findByRole("table", { name: "Order lines" });
    expect(within(table).getAllByRole("columnheader")).toHaveLength(8);
    expect(within(table).getAllByRole("row")).toHaveLength(3);
    for (const label of ["Description", "Quantity", "Unit price"]) {
      expect(box(label, 2)).toBeVisible();
    }
    expect(await item(2)).toHaveValue("I-0002  Norvale Wired Keyboard");
    expect(screen.getByRole("button", { name: "Remove line 2" })).toBeVisible();
  });

  it("types an item, Enter picks it and lands on the quantity", async () => {
    const user = userEvent.setup();
    renderGrid();
    await user.type(await item(1), "NV-WM-100{Enter}");
    await waitFor(() => {
      expect(box("Quantity", 1)).toHaveFocus();
    });
    expect(box("Description", 1)).toHaveValue("Wireless mouse, 2.4 GHz");
    expect(box("Unit price", 1)).toHaveValue("18.40");
    expect(screen.getByText("40 PCS available")).toBeVisible();
  });

  it("walks Enter through the cells, and adds a line after the last", async () => {
    const user = userEvent.setup();
    renderGrid({ lines: [SAVED[0] ?? line()] });
    await screen.findByRole("table");
    await user.click(await item(1));
    await user.keyboard("{Enter}");
    expect(box("Description", 1)).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(box("Quantity", 1)).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(box("Unit price", 1)).toHaveFocus();
    expect(lines()).toBe(1);
    await user.keyboard("{Enter}");
    expect(lines()).toBe(2);
    await waitFor(async () => {
      expect(await item(2)).toHaveFocus();
    });
  });

  it("keeps Delete for the text being typed", async () => {
    const user = userEvent.setup();
    renderGrid({ lines: SAVED });
    await screen.findByRole("table");
    const quantity = box("Quantity", 1);
    await user.click(quantity);
    await user.keyboard("{Home}{Delete}");
    expect(quantity).toHaveValue("");
    expect(lines()).toBe(2);
  });

  it("removes the line on Delete when the line itself has the focus", async () => {
    const user = userEvent.setup();
    renderGrid({ lines: SAVED });
    await screen.findByRole("table");
    await user.click(box("Quantity", 1));
    await user.keyboard("{Escape}");
    expect(screen.getByRole("row", { name: "Line 1" })).toHaveFocus();
    await user.keyboard("{Delete}");
    expect(lines()).toBe(1);
    expect(await item(1)).toHaveValue("I-0002  Norvale Wired Keyboard");
    expect(useToastStore.getState().items[0]?.message).toBe("Removed line 1");
  });

  it("removes the line from inside a field on Ctrl+Delete", async () => {
    const user = userEvent.setup();
    renderGrid({ lines: SAVED });
    await screen.findByRole("table");
    await user.click(box("Quantity", 2));
    await user.keyboard("{Control>}{Delete}{/Control}");
    expect(lines()).toBe(1);
    expect(box("Quantity", 1)).toHaveFocus();
  });

  it("removes with the visible button, then Undo puts the line back", async () => {
    const user = userEvent.setup();
    renderGrid({ lines: SAVED });
    await user.click(
      await screen.findByRole("button", { name: "Remove line 1" }),
    );
    expect(lines()).toBe(1);
    expect(screen.getByRole("button", { name: "Remove line 1" })).toHaveFocus();
    await user.click(await screen.findByRole("button", { name: "Undo" }));
    await waitFor(() => {
      expect(lines()).toBe(2);
    });
    expect(box("Quantity", 1)).toHaveValue("3");
    expect(box("Quantity", 2)).toHaveValue("12");
  });

  it("moves between lines with the arrows off the text, and Alt in it", async () => {
    const user = userEvent.setup();
    renderGrid({ lines: SAVED });
    await screen.findByRole("table");
    await user.click(box("Quantity", 1));
    await user.keyboard("{Escape}{ArrowDown}");
    expect(screen.getByRole("row", { name: "Line 2" })).toHaveFocus();
    await user.keyboard("{ArrowUp}");
    expect(screen.getByRole("row", { name: "Line 1" })).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(await item(1)).toHaveFocus();
    await user.keyboard("{Alt>}{ArrowDown}{/Alt}");
    expect(await item(2)).toHaveFocus();
    await user.keyboard("{Alt>}{ArrowUp}{/Alt}");
    expect(await item(1)).toHaveFocus();
  });

  it("moves down a column on the arrows from a quantity", async () => {
    const user = userEvent.setup();
    renderGrid({ lines: SAVED });
    await screen.findByRole("table");
    await user.click(box("Quantity", 1));
    await user.keyboard("{ArrowDown}");
    expect(box("Quantity", 2)).toHaveFocus();
  });
});

describe("what picking an item does to the price", () => {
  it("leaves the price empty and shows the list price as context when asked", async () => {
    const user = userEvent.setup();
    renderGrid({ itemPrice: "reference" });
    await user.type(await item(1), "NV-WM-100{Enter}");
    await waitFor(() => {
      expect(box("Quantity", 1)).toHaveFocus();
    });
    expect(box("Unit price", 1)).toHaveValue("");
    expect(screen.getByText("List price 18.40")).toBeVisible();
    expect(screen.getByText(", for reference")).toBeInTheDocument();
  });

  it("drops the list price when the item is cleared", async () => {
    const user = userEvent.setup();
    renderGrid({ itemPrice: "reference" });
    await user.type(await item(1), "NV-WM-100{Enter}");
    expect(await screen.findByText("List price 18.40")).toBeVisible();
    await user.clear(await item(1));
    expect(screen.queryByText("List price 18.40")).not.toBeInTheDocument();
  });

  it("keeps a typed price when the item changes in reference mode", async () => {
    const user = userEvent.setup();
    renderGrid({ itemPrice: "reference", lines: [SAVED[0] ?? line()] });
    await screen.findByRole("table");
    const field = await item(1);
    await user.clear(field);
    await user.type(field, "I-0002{Enter}");
    await waitFor(() => {
      expect(box("Quantity", 1)).toHaveFocus();
    });
    expect(box("Unit price", 1)).toHaveValue("19.99");
  });
});
