import { readFileSync } from "node:fs";
import path from "node:path";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Button, buttonVariants } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { FilterChips } from "./FilterChips";
import { MaskedValue } from "./MaskedValue";
import { SelectHead } from "./data-table/SelectCells";
import { SortHeader } from "./data-table/SortHeader";

// jsdom does not lay out CSS, so this checks that each control carries the
// class that only a coarse pointer switches on. The real sizes are measured
// on a tablet in the browser (the story's touch script).
const dtCss = readFileSync(
  path.join(import.meta.dirname, "data-table", "data-table.css"),
  "utf8",
);

describe("touch targets on a coarse pointer", () => {
  it("gives every Button size a 44 px minimum", () => {
    for (const size of [
      "default",
      "xs",
      "sm",
      "lg",
      "icon",
      "icon-xs",
      "icon-sm",
      "icon-lg",
    ] as const) {
      const classes = buttonVariants({ size });
      expect(classes, size).toMatch(/pointer-coarse:(min-h|size)-11/);
    }
    render(<Button>Check the chain</Button>);
    expect(screen.getByRole("button").className).toContain(
      "pointer-coarse:min-h-11",
    );
  });

  it("gives the Switch a 44 px reach without changing how it looks", () => {
    render(<Switch aria-label="Allowed" />);
    const root = screen.getByRole("switch");
    expect(root.className).toContain("h-5");
    expect(root.className).toContain("w-9");
    expect(root.className).toContain("relative");
    expect(root.className).toContain("pointer-coarse:after:-inset-y-[13px]");
    expect(root.className).toContain("pointer-coarse:after:-inset-x-[5px]");
  });

  it("makes the clear button of a filter chip 44 px", () => {
    render(
      <FilterChips
        chips={[{ id: "stock", label: "Waiting on stock" }]}
        filters={{ stock: "waiting" }}
        onChange={vi.fn()}
      />,
    );
    expect(
      screen.getByRole("button", { name: /Waiting on stock/ }),
    ).toBeInTheDocument();
    expect(dtCss).toMatch(
      /@media \(pointer: coarse\) \{\s*\.dt-chip > button \{\s*width: 2\.75rem;\s*height: 2\.75rem;/,
    );
  });

  it("makes the Why is this hidden button 44 px through the Button", () => {
    render(<MaskedValue masked reason="price" />);
    const button = screen.getByRole("button", { name: /hidden/i });
    expect(button.className).toContain("pointer-coarse:size-11");
  });

  it("makes a sortable heading 44 px high", () => {
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
    expect(button.className).toContain("pointer-coarse:min-h-11");
    // The button must fit inside the heading, or the sticky edge clips it.
    expect(screen.getByRole("columnheader").className).toContain(
      "pointer-coarse:h-11",
    );
  });

  it("draws the row checkbox as a real 44 px square", () => {
    render(
      <table>
        <thead>
          <tr>
            <SelectHead
              selection={{
                pageState: "none",
                onTogglePage: vi.fn(),
                onToggle: vi.fn(),
                isSelected: () => false,
                rowLabel: () => "row",
              }}
            />
          </tr>
        </thead>
      </table>,
    );
    expect(screen.getByRole("checkbox").className).toContain("dt-box");
    expect(dtCss).toMatch(
      /@media \(pointer: coarse\) \{\s*\.dt-box \{[^}]*width: 2\.75rem;\s*height: 2\.75rem;/,
    );
  });
});
