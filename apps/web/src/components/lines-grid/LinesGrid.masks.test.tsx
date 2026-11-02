import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import i18n from "@/i18n";
import { useToastStore } from "@/components/common/toast";
import { axeViolations } from "@/test/axe";
import { lineDraftOptions } from "./lineValues";
import { line, renderGrid, SAVED, signInAs } from "./linesHarness";

beforeAll(async () => {
  await i18n.loadNamespaces(["form", "linesGrid", "components"]);
});

beforeEach(() => {
  localStorage.clear();
  useToastStore.setState({ items: [] });
  signInAs("WAREHOUSE");
});

const item = (n: number) =>
  screen.findByRole("combobox", { name: `Item, line ${String(n)}` });
const box = (label: string, n: number) =>
  screen.getByRole("textbox", { name: `${label}, line ${String(n)}` });
const save = () => screen.getByRole("button", { name: /^Save/ });

const MASK = { reason: "price", visibleTo: "Support and Finance" } as const;

function everythingStored(): string {
  return Object.keys(localStorage)
    .map((key) => localStorage.getItem(key) ?? "")
    .join("\n");
}

describe("a grid that hides prices from the role", () => {
  it("has no price to type, and shows the mask where it would be", async () => {
    renderGrid({ lines: [line()], priceMask: MASK });
    await item(1);
    expect(
      screen.queryByRole("textbox", { name: "Unit price, line 1" }),
    ).toBeNull();
    // The price and the amount of the one line, and the total.
    expect(screen.getAllByRole("img", { name: "Hidden" })).toHaveLength(3);
  });

  it("never writes a price, even when the item has one", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn((values: unknown) => Promise.resolve(values));
    renderGrid({ lines: [line()], priceMask: MASK, onSave });
    await user.type(await item(1), "I-0001{Enter}");
    await waitFor(() => {
      expect(box("Quantity", 1)).toHaveFocus();
    });
    await user.keyboard("5");
    expect(box("Description", 1)).toHaveValue("Wireless mouse, 2.4 GHz");
    await user.click(save());
    await waitFor(() => {
      expect(onSave).toHaveBeenCalled();
    });
    expect(onSave.mock.calls[0]?.[0]).toMatchObject({
      lines: [{ quantity: "5", unitPrice: "" }],
    });
    expect(document.body.textContent).not.toMatch(/18\.4|USD \d/);
  });

  it("keeps a masked value out of the draft, whatever the form holds", async () => {
    const user = userEvent.setup();
    // A price in the form is there by accident: the API never sends one.
    renderGrid({
      lines: SAVED.map((l) => ({ ...l, unitPrice: "19.99" })),
      priceMask: MASK,
    });
    await screen.findByRole("table");
    await user.type(box("Quantity", 1), "4");
    await waitFor(() => {
      expect(everythingStored()).toContain("lineId");
    });
    expect(everythingStored()).not.toContain("19.99");
    expect(everythingStored()).not.toContain("availableStock");
  });

  it("restores the right stock to the right line after a line was deleted", async () => {
    const user = userEvent.setup();
    const first = renderGrid({ lines: SAVED });
    await screen.findByRole("table");
    await user.click(screen.getByRole("button", { name: "Remove line 1" }));
    await user.type(box("Description", 1), " x");
    await waitFor(() => {
      expect(everythingStored()).toContain("L2");
    });
    first.unmount();
    renderGrid({ lines: SAVED });
    // Line 2 is now first. Matched by position it would claim line 1's 40.
    expect(await screen.findByText("Short by 4")).toBeVisible();
    expect(screen.queryByText("40 PCS available")).toBeNull();
  });

  it("passes axe with a short line, an error and a mask on the page", async () => {
    const user = userEvent.setup();
    renderGrid({ lines: SAVED });
    await screen.findByRole("table");
    await user.clear(box("Quantity", 1));
    await user.tab();
    await screen.findByText("Enter a quantity.");
    expect(await axeViolations(document.body)).toEqual([]);
  });
});

describe("what a screen needs for its draft", () => {
  it("matches rows on the line id and leaves prices out only when masked", () => {
    expect(lineDraftOptions("lines", false)).toEqual({
      rowKey: "lineId",
      exclude: ["lines.*.availableStock"],
    });
    expect(lineDraftOptions("lines", true).exclude).toContain(
      "lines.*.unitPrice",
    );
  });
});
