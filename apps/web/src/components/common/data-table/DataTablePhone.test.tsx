import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DataTable } from "./DataTable";
import { DEFAULT_QUERY, type DataTableColumn } from "./types";

interface Row {
  id: string;
  no: string;
  name: string;
  state: string;
}

const columns: DataTableColumn<Row>[] = [
  { id: "no", header: "Number", cell: (r) => r.no, hideable: false },
  { id: "name", header: "Name", cell: (r) => r.name },
  { id: "state", header: "State", cell: (r) => r.state },
];
const rows: Row[] = [{ id: "a", no: "C-001", name: "Acme", state: "Active" }];

const realMatchMedia = window.matchMedia.bind(window);

function setPhone(phone: boolean) {
  window.matchMedia = (query: string) =>
    ({
      matches: phone && query === "(max-width: 767px)",
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }) as unknown as MediaQueryList;
}

function draw() {
  render(
    <DataTable<Row>
      tableId="phone"
      caption="Customers"
      columns={columns}
      rows={rows}
      total={rows.length}
      query={DEFAULT_QUERY}
      onQueryChange={() => undefined}
      rowKey={(r) => r.id}
      selection={{
        isSelected: () => false,
        onToggle: () => undefined,
        onTogglePage: () => undefined,
        pageState: "none",
        rowLabel: (r) => r.no,
      }}
    />,
  );
}

afterEach(() => {
  window.matchMedia = realMatchMedia;
  vi.restoreAllMocks();
});

describe("a row on a phone", () => {
  it("shows the next columns under the first, so rows are told apart", () => {
    setPhone(true);
    draw();
    const first = screen.getAllByText("C-001")[0]?.closest("td");
    expect(first).toHaveTextContent("Acme");
    expect(first).toHaveTextContent("Active");
  });

  it("is a plain table above 768 px", () => {
    setPhone(false);
    draw();
    expect(screen.getByText("C-001").closest("td")).not.toHaveTextContent(
      "Acme",
    );
  });
});

describe("the row checkbox", () => {
  it("is 24 px, and grows its target to 44 px on a touch screen", () => {
    setPhone(false);
    draw();
    const box = screen.getByRole("checkbox", { name: "Select C-001" });
    expect(box).toHaveClass("size-6");
    expect(box.className).toContain("pointer-coarse:after:-inset-[11px]");
  });
});
