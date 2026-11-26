import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, describe, expect, it } from "vitest";
import i18n from "@/i18n";
import { PoDifferences } from "./PoDifferences";
import { differences, maskedDifferences } from "./versionsTestKit";

beforeAll(async () => {
  await i18n.loadNamespaces(["directions-orders", "directions-parts"]);
});

describe("the differences between two PO versions", () => {
  it("says the PO versions are the same when nothing differs", () => {
    const base = differences();
    render(
      <PoDifferences
        currency="USD"
        differences={{
          ...base,
          identical: true,
          header: base.header.map((row) => ({
            ...row,
            to: row.from,
            changed: false,
          })),
          lines: [],
          counts: { added: 0, removed: 0, changed: 0, moved: 0, unchanged: 4 },
        }}
      />,
    );
    expect(
      screen.getByText(
        "PO version 2 has the same dates, quantities and prices as PO version 1.",
      ),
    ).toBeVisible();
    expect(screen.queryByRole("table")).toBeNull();
  });

  it("reads a change as 'from to to' with the full phrase for a screen reader", () => {
    render(<PoDifferences currency="USD" differences={differences()} />);
    const row = screen
      .getAllByRole("row")
      .find((candidate) => candidate.textContent.includes("I-0001"));
    if (!row) throw new Error("no row");
    // The visible words are hidden from a screen reader, which hears the phrase.
    expect(within(row).getByText("2 to 5")).toHaveAttribute(
      "aria-hidden",
      "true",
    );
    expect(within(row).getByText("Quantity changed from 2 to 5")).toHaveClass(
      "sr-only",
    );
  });

  it("never draws a price for a masked difference", () => {
    const view = render(
      <PoDifferences currency="USD" differences={maskedDifferences()} />,
    );
    expect(view.container.textContent).not.toMatch(/\d+\.\d{2}\b(?!%)/);
    expect(
      screen.getByText("Prices are not compared for your role."),
    ).toBeVisible();
  });

  it("lists the header first", () => {
    render(<PoDifferences currency="USD" differences={differences()} />);
    const header = screen.getByText("Order date").closest("dl");
    const table = screen.getByRole("table");
    if (!header) throw new Error("no header block");
    expect(
      header.compareDocumentPosition(table) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      within(header)
        .getAllByRole("term")
        .map((term) => term.textContent),
    ).toEqual([
      "Order date",
      "Shipment date",
      "Prepayment",
      "Currency",
      "Total",
    ]);
    // The total is a price: figures and a Changed chip.
    expect(within(header).getByText("USD 100.00 to USD 125.00")).toBeVisible();
  });

  it("compact shows only changed lines and a button for the unchanged ones", async () => {
    const user = userEvent.setup();
    render(
      <PoDifferences currency="USD" differences={differences()} compact />,
    );
    const table = screen.getByRole("table");
    // The moved line is shown with the changed and the added; the plain one is not.
    expect(within(table).getByText("I-0001")).toBeVisible();
    expect(within(table).getByText("I-0003")).toBeVisible();
    expect(within(table).getByText("I-0002")).toBeVisible();
    expect(within(table).queryByText("I-0004")).toBeNull();
    const more = screen.getByRole("button", {
      name: "Show the 1 unchanged line",
    });
    expect(more).toHaveAttribute("aria-expanded", "false");
    await user.click(more);
    expect(within(table).getByText("I-0004")).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Hide the unchanged lines" }),
    ).toHaveAttribute("aria-expanded", "true");
  });

  it("announces the counts as a status, and leaves that to the page when asked", () => {
    const view = render(
      <PoDifferences currency="USD" differences={differences()} />,
    );
    expect(screen.getByRole("status")).toHaveTextContent(
      "1 added, 0 removed, 1 changed, 1 moved, 1 unchanged",
    );
    view.rerender(
      <PoDifferences
        currency="USD"
        differences={differences()}
        liveCounts={false}
      />,
    );
    expect(screen.queryByRole("status")).toBeNull();
  });

  describe("when the lines only changed places", () => {
    const base = differences();
    const kept = base.lines.filter((line) => line.status === "unchanged");
    const moved = {
      ...base,
      identical: false,
      header: base.header.map((row) => ({
        ...row,
        to: row.from,
        changed: false,
      })),
      lines: kept,
      counts: { added: 0, removed: 0, changed: 0, moved: 1, unchanged: 2 },
    };

    it("says that only the order differs, marks the moved line, and counts it as moved", () => {
      render(<PoDifferences currency="USD" differences={moved} />);
      expect(
        screen.getByText(
          "Only the order of the lines differs between these PO versions.",
        ),
      ).toBeVisible();
      const row = screen
        .getAllByRole("row")
        .find((candidate) => candidate.textContent.includes("I-0002"));
      if (!row) throw new Error("no row");
      expect(row.querySelector("[data-slot=badge]")).toHaveTextContent(
        /^Moved$/,
      );
      expect(screen.getByRole("status")).toHaveTextContent(
        "0 added, 0 removed, 0 changed, 1 moved, 1 unchanged",
      );
    });

    it("does not say it when a date, a quantity or a line also differs", () => {
      render(<PoDifferences currency="USD" differences={differences()} />);
      expect(screen.queryByText(/Only the order of the lines/)).toBeNull();
    });
  });
});
