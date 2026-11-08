import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { FilterChips } from "./FilterChips";
import { MaskedValue } from "./MaskedValue";
import { SortHeader } from "./data-table/SortHeader";

// jsdom does not lay out CSS, so this checks that each control carries the
// invisible 44 px hit area that only a coarse pointer switches on.
const COARSE = "pointer-coarse:after:";

describe("touch targets on a coarse pointer", () => {
  it("widens the clear button of a filter chip", () => {
    render(
      <FilterChips
        chips={[{ id: "stock", label: "Waiting on stock" }]}
        filters={{ stock: "waiting" }}
        onChange={vi.fn()}
      />,
    );
    const button = screen.getByRole("button", { name: /Waiting on stock/ });
    expect(button.className).toContain(COARSE);
    expect(button.className).toContain("relative");
  });

  it("widens the Why is this hidden button", () => {
    render(<MaskedValue masked reason="price" />);
    const button = screen.getByRole("button", { name: /hidden/i });
    expect(button.className).toContain(COARSE);
    expect(button.className).toContain("relative");
  });

  it("widens a sortable heading", () => {
    render(
      <table>
        <thead>
          <tr>
            <SortHeader
              column={{
                id: "orderNo",
                header: "Order",
                cell: () => null,
                exportValue: () => "",
                sortable: true,
              }}
              sort={null}
              onSort={vi.fn()}
            />
          </tr>
        </thead>
      </table>,
    );
    const button = screen.getByRole("button", { name: /Order/ });
    expect(button.className).toContain(COARSE);
    expect(button.className).toContain("relative");
    // The hit area must fit inside the heading, or the sticky edge clips it.
    expect(screen.getByRole("columnheader").className).toContain(
      "pointer-coarse:h-11",
    );
  });

  it("reaches 48 px around the Why is this hidden button, past the row padding", () => {
    render(<MaskedValue masked reason="price" />);
    expect(screen.getByRole("button", { name: /hidden/i }).className).toContain(
      "pointer-coarse:after:-inset-3",
    );
  });
});
