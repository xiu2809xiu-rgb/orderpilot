import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { HomeTable, type HomeColumn, type HomeRow } from "./HomeTable";

const COLUMNS: HomeColumn[] = [
  { id: "what", label: "Task", single: true },
  { id: "amount", label: "Amount", end: true },
  { id: "due", label: "Due" },
  { id: "action", label: "Action", action: true },
];
const ROWS: HomeRow[] = [
  {
    id: "1",
    cells: {
      what: "Confirm the prepayment",
      amount: "USD 5,303.77 of 10,607.54",
      due: "30 Oct 2026",
      action: <button type="button">Confirm</button>,
    },
  },
];

/** jsdom has no layout: say how wide the table wants to be and how wide its card is. */
function layout(tableWants: number, cardIs: number) {
  vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockReturnValue(
    tableWants,
  );
  vi.spyOn(Element.prototype, "clientWidth", "get").mockReturnValue(cardIs);
}

function show() {
  render(
    <MemoryRouter>
      <HomeTable label="Needs you" columns={COLUMNS} rows={ROWS} />
    </MemoryRouter>,
  );
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("HomeTable", () => {
  it("is a table while every column fits its card", () => {
    layout(700, 806);
    show();
    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
  });

  // The amount a person confirms must never sit behind a sideways scroll.
  it("gives way to stacked rows, whole, when the card is narrower than the table", () => {
    layout(864, 806);
    show();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    const list = screen.getByRole("list", { name: "Needs you" });
    expect(list).toHaveTextContent("Confirm the prepayment");
    expect(list).toHaveTextContent("USD 5,303.77 of 10,607.54");
    expect(list).toHaveTextContent("30 Oct 2026");
    expect(screen.getByRole("button", { name: "Confirm" })).toBeInTheDocument();
  });

  it("allows a pixel of rounding", () => {
    layout(807, 806);
    show();
    expect(screen.getByRole("table")).toBeInTheDocument();
  });
});
