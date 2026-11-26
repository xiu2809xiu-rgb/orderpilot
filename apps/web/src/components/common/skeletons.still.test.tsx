import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DataTable } from "./data-table/DataTable";
import { DEFAULT_QUERY, type DataTableColumn } from "./data-table/types";
import {
  ListPageSkeleton,
  PageHeaderSkeleton,
  SectionCardSkeleton,
  TableSkeleton,
} from "./skeletons";
import { RowSkeletons } from "@/features/directions/screens/home/RowSkeletons";
import { OrdersSkeleton } from "@/features/directions/screens/orders/OrdersSkeleton";

// Page and card skeletons shimmer (ui/skeleton.test.tsx); tables and lists stay
// still, because a work screen is never animated while it is in use. A class on
// the block is all jsdom can see, so motion.css and a real browser say the rest.

function blocks(container: HTMLElement): Element[] {
  return [...container.querySelectorAll('[data-slot="skeleton"]')];
}

function expectStill(container: HTMLElement, atLeast = 1) {
  const all = blocks(container);
  expect(all.length).toBeGreaterThanOrEqual(atLeast);
  for (const block of all) {
    expect(block).not.toHaveClass("dx-shimmer");
    expect(block).toHaveClass("animate-none");
  }
}

interface Row {
  id: string;
}
const columns: DataTableColumn<Row>[] = [
  { id: "id", header: "Number", cell: (r) => r.id, hideable: false },
];

describe("table and list skeletons stay still", () => {
  it("the table skeleton, the page header and the section card", () => {
    expectStill(render(<TableSkeleton />).container, 10);
    expectStill(render(<PageHeaderSkeleton />).container, 2);
    expectStill(render(<SectionCardSkeleton />).container, 3);
  });

  it("the list page, which announces loading once", () => {
    const { container } = render(<ListPageSkeleton />);
    expectStill(container, 10);
    expect(screen.getByRole("status")).toHaveTextContent("Loading");
  });

  it("the placeholder rows of a data table that is loading", () => {
    const { container } = render(
      <DataTable<Row>
        tableId="still"
        caption="Orders"
        columns={columns}
        rows={[]}
        total={0}
        status="loading"
        query={DEFAULT_QUERY}
        onQueryChange={() => undefined}
        rowKey={(r) => r.id}
      />,
    );
    expectStill(container);
  });

  it("the rows of a list on Home", () => {
    expectStill(render(<RowSkeletons rows={2} />).container, 6);
  });

  it("the rows of the orders table, while the head and filters shimmer", () => {
    const { container } = render(<OrdersSkeleton />);
    const all = blocks(container);
    expect(all.filter((b) => b.classList.contains("dx-shimmer"))).toHaveLength(
      6,
    );
    expect(
      all.filter((b) => b.classList.contains("animate-none")),
    ).toHaveLength(10);
  });
});
