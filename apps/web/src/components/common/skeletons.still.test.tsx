import { render, screen } from "@testing-library/react";
import { beforeAll, describe, expect, it } from "vitest";
import i18n from "@/i18n";
import { DataTable } from "./data-table/DataTable";
import { DEFAULT_QUERY, type DataTableColumn } from "./data-table/types";
import {
  ListPageSkeleton,
  PageHeaderSkeleton,
  SectionCardSkeleton,
  TableSkeleton,
} from "./skeletons";
import { RowSkeletons } from "@/features/directions/screens/home/RowSkeletons";
import { BoardState } from "@/features/directions/screens/orders/BoardState";
import { OrdersSkeleton } from "@/features/directions/screens/orders/OrdersSkeleton";
import { InsightsSkeleton } from "@/features/insights/InsightsSkeleton";
import { RecordSkeleton } from "@/features/master-data/RecordState";

// The rule: a block that stands for a page head, a card, a tile, a chart or a
// panel shimmers; the rows of a table or a list, and the cards of a board, stay
// still, because a work screen is never animated while it is in use. A class on
// the block is all jsdom can see, so motion.css and a real browser say the rest.

beforeAll(async () => {
  // BoardState reads its words from this namespace; unloaded, it suspends.
  await i18n.loadNamespaces(["components", "directions-orders"]);
});

function blocks(container: HTMLElement): Element[] {
  return [...container.querySelectorAll('[data-slot="skeleton"]')];
}

function expectShimmer(container: HTMLElement, exactly: number) {
  const all = blocks(container);
  expect(all).toHaveLength(exactly);
  for (const block of all) {
    expect(block).toHaveClass("dx-shimmer");
    expect(block).not.toHaveClass("animate-none");
  }
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
  it("the table skeleton, header and rows", () => {
    expectStill(render(<TableSkeleton />).container, 45);
  });

  it("the list page: its table stays still while its head and filter bar shimmer", () => {
    const { container } = render(<ListPageSkeleton />);
    const all = blocks(container);
    expect(all.filter((b) => b.classList.contains("dx-shimmer"))).toHaveLength(
      3,
    );
    expectStill(
      container.querySelector("table")?.parentElement ?? container,
      45,
    );
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

  it("the cards of the orders board", () => {
    const { container } = render(
      <BoardState
        status="loading"
        error={undefined}
        onRetry={() => undefined}
      />,
    );
    expectStill(container, 16);
  });
});

describe("page, card and tile skeletons shimmer", () => {
  it("the page header, two blocks", () => {
    expectShimmer(render(<PageHeaderSkeleton />).container, 2);
  });

  it("the section card: its head and every line of it", () => {
    expectShimmer(render(<SectionCardSkeleton />).container, 4);
    expectShimmer(render(<SectionCardSkeleton lines={1} />).container, 2);
  });

  it("the chart tiles and the chart card of Insights", () => {
    expectShimmer(render(<InsightsSkeleton />).container, 5 + 5);
  });

  it("the facts block and the sections of a master-data record", () => {
    // Header (2), the facts block (1), two section cards of a head and four lines (10).
    expectShimmer(render(<RecordSkeleton />).container, 2 + 1 + 10);
  });
});
