import { render, screen, within } from "@testing-library/react";
import { must } from "@/test/must";
import { afterEach, describe, expect, it } from "vitest";
import { Money } from "../Money";
import { PageHeader } from "../PageHeader";
import { usePrimaryActionStore } from "../primaryAction";
import { ListPageSkeleton, TableSkeleton } from "../skeletons";
import { DataTable } from "./DataTable";
import { DEFAULT_QUERY, type DataTableColumn } from "./types";

interface Row {
  id: string;
  name: string;
  qty: number;
  amount: string;
  day: string;
}

const columns: DataTableColumn<Row>[] = [
  { id: "name", header: "Customer", cell: (r) => r.name, hideable: false },
  { id: "qty", header: "Quantity", cell: (r) => r.qty, kind: "number" },
  {
    id: "amount",
    header: "Amount",
    cell: (r) => <Money value={r.amount} />,
    kind: "money",
  },
  { id: "day", header: "Ordered", cell: (r) => r.day, kind: "date" },
];

const rows: Row[] = [
  { id: "a", name: "Synthetic Foods", qty: 12, amount: "12340", day: "2 Nov" },
];

function table(props: Partial<Parameters<typeof DataTable<Row>>[0]> = {}) {
  return (
    <DataTable<Row>
      tableId="dense"
      caption="Orders"
      columns={columns}
      rows={rows}
      total={rows.length}
      query={DEFAULT_QUERY}
      onQueryChange={() => undefined}
      rowKey={(r) => r.id}
      {...props}
    />
  );
}

afterEach(() => {
  usePrimaryActionStore.setState({ current: null });
});

describe("dense table", () => {
  it("right-aligns number and money columns in tabular figures, and not text", () => {
    render(table());
    const cells = within(must(screen.getAllByRole("row")[1])).getAllByRole(
      "cell",
    );
    expect(cells[0]).not.toHaveClass("text-right");
    expect(cells[1]).toHaveClass("text-right", "tabular-nums");
    expect(cells[2]).toHaveClass("text-right", "tabular-nums");
    expect(cells[3]).not.toHaveClass("text-right");
    expect(cells[3]).toHaveClass("whitespace-nowrap");
    const heads = screen.getAllByRole("columnheader");
    expect(heads[1]).toHaveClass("text-right");
    expect(heads[2]).toHaveClass("text-right");
    expect(heads[0]).not.toHaveClass("text-right");
  });

  it("keeps rows to one line plus 8 px above and below, and headings sticky", () => {
    render(table());
    const cell = within(must(screen.getAllByRole("row")[1])).getAllByRole(
      "cell",
    )[0];
    expect(cell).toHaveClass("py-2");
    const head = screen.getAllByRole("columnheader")[1];
    expect(head).toHaveClass("sticky", "top-0", "h-9");
  });

  it("keeps the first column in view when the table scrolls sideways", () => {
    render(table());
    const heads = screen.getAllByRole("columnheader");
    expect(heads[0]).toHaveClass("sticky", "left-0");
    expect(heads[1]).not.toHaveClass("left-0");
    const cells = within(must(screen.getAllByRole("row")[1])).getAllByRole(
      "cell",
    );
    expect(cells[0]).toHaveClass("sticky", "left-0");
    expect(cells[1]).not.toHaveClass("left-0");
  });

  it("scrolls inside its own container, so the page does not scroll sideways", () => {
    render(table());
    const region = screen.getByRole("region", { name: /Orders/ });
    expect(region).toHaveClass("overflow-auto");
    expect(region.className).toContain("max-h-");
  });

  it("shows a skeleton with the same columns and the same cell shape as the data", () => {
    render(table({ status: "loading", rows: [] }));
    const loading = screen.getAllByRole("row");
    // One heading row, then placeholder rows.
    expect(loading.length).toBeGreaterThan(2);
    const first = within(must(loading[1])).getAllByRole("cell");
    expect(first).toHaveLength(columns.length);
    expect(first[1]).toHaveClass("text-right", "py-2");
    expect(first[0]).toHaveClass("sticky", "py-2");
  });
});

describe("empty state", () => {
  it("is a compact strip that offers the page's primary action", () => {
    render(
      <>
        <PageHeader
          title="Orders"
          primaryAction={{ label: "New order", onRun: () => undefined }}
        />
        {table({ rows: [], total: 0 })}
      </>,
    );
    const heading = screen.getByRole("heading", { name: "Nothing here yet" });
    const strip = heading.closest("div[class*='border-dashed']");
    expect(strip?.className).not.toContain("p-s4");
    const buttons = screen.getAllByRole("button", { name: /New order/ });
    // The header button and the empty state's own.
    expect(buttons).toHaveLength(2);
  });

  it("still names a next step when the page has no primary action", () => {
    render(table({ rows: [], total: 0 }));
    expect(
      screen.getByText(/Records appear here as they are added/),
    ).toBeInTheDocument();
  });
});

describe("skeletons", () => {
  it("match the table: a header row at 36 px and dense body rows", () => {
    const { container } = render(<TableSkeleton columns={3} rows={2} />);
    expect(container.querySelectorAll("tbody tr")).toHaveLength(2);
    expect(container.querySelectorAll("tbody tr:first-child td")).toHaveLength(
      3,
    );
    expect(container.querySelector("th")).toHaveClass("h-9");
    expect(container.querySelector("td")).toHaveClass("py-2");
    // Nothing pulses on a work screen.
    expect(container.querySelector("[data-slot='skeleton']")).toHaveClass(
      "animate-none",
    );
  });

  it("stand in for the whole list page and announce loading once", () => {
    render(<ListPageSkeleton />);
    expect(screen.getByRole("status")).toHaveTextContent("Loading");
  });
});

describe("Money", () => {
  it("shows the currency and two decimals from the decimal string", () => {
    render(<Money value="12340" />);
    expect(screen.getByText("USD 12,340.00")).toHaveClass("tabular-nums");
  });
});

describe("PageHeader", () => {
  it("shows the total quietly and the primary action with its key hint", () => {
    render(
      <PageHeader
        title="Orders"
        total={1284}
        primaryAction={{ label: "New order", onRun: () => undefined }}
      />,
    );
    expect(screen.getByText("1,284")).toBeInTheDocument();
    const button = screen.getByRole("button", { name: /New order/ });
    expect(button).toHaveAttribute("aria-keyshortcuts", "N");
    expect(button).toHaveTextContent("N");
  });
});
