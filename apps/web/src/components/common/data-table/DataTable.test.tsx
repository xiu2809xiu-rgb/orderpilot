import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api/errors";
import { useSessionStore } from "@/stores/session";
import { axeViolations } from "@/test/axe";
import { sessionFor } from "@/test/fixtures";
import { DataTable, type DataTableProps } from "./DataTable";
import { DEFAULT_QUERY, type DataTableColumn, type TableQuery } from "./types";

interface Row {
  id: string;
  name: string;
  active: boolean;
  total: number;
}

const ALL: Row[] = Array.from({ length: 23 }, (_, index) => ({
  id: `r${String(index + 1)}`,
  name: `Customer ${String.fromCharCode(65 + (index % 26))}${String(index + 1)}`,
  active: index % 3 !== 0,
  total: (index + 1) * 10,
}));

const columns: DataTableColumn<Row>[] = [
  {
    id: "name",
    header: "Customer",
    cell: (r) => r.name,
    exportValue: (r) => r.name,
    sortable: true,
    hideable: false,
  },
  {
    id: "total",
    header: "Total",
    cell: (r) => String(r.total),
    exportValue: (r) => r.total,
    sortable: true,
    align: "end",
  },
  {
    id: "active",
    header: "Active",
    cell: (r) => (r.active ? "Yes" : "No"),
    exportValue: (r) => r.active,
  },
  {
    id: "internal",
    header: "Internal note",
    cell: () => "note",
    defaultHidden: true,
  },
];

/** What a server does with a query. The table must not do any of this itself. */
function serve(query: TableQuery) {
  let rows = ALL.filter(
    (r) =>
      r.name.toLowerCase().includes(query.search.toLowerCase()) &&
      (query.filters.active !== true || r.active),
  );
  if (query.sort) {
    const { columnId, direction } = query.sort;
    const key = columnId as "name" | "total";
    rows = [...rows].sort((a, b) =>
      a[key] < b[key] ? -1 : a[key] > b[key] ? 1 : 0,
    );
    if (direction === "desc") rows.reverse();
  }
  const start = (query.page - 1) * query.pageSize;
  return {
    rows: rows.slice(start, start + query.pageSize),
    total: rows.length,
  };
}

function Harness(props: Partial<DataTableProps<Row>>) {
  const [query, setQuery] = useState<TableQuery>({
    ...DEFAULT_QUERY,
    pageSize: 10,
  });
  const { rows, total } = serve(query);
  return (
    <DataTable
      tableId="customers"
      caption="Customers"
      columns={columns}
      rows={rows}
      total={total}
      query={query}
      onQueryChange={setQuery}
      rowKey={(r) => r.id}
      toggleFilters={[{ id: "active", label: "Show active only" }]}
      searchDebounceMs={0}
      {...props}
    />
  );
}

function names() {
  const [, body] = screen.getAllByRole("rowgroup");
  if (!body) throw new Error("no table body");
  return within(body)
    .getAllByRole("row")
    .map((row) => within(row).getAllByRole("cell")[0]?.textContent);
}

beforeEach(() => {
  localStorage.clear();
  useSessionStore.getState().setSession(sessionFor("SUPPORT"));
});
afterEach(() => {
  useSessionStore.setState({ status: "booting", session: null });
});

describe("DataTable with a server", () => {
  it("shows the first page and moves between pages", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    expect(names()).toHaveLength(10);
    expect(screen.getByText("Showing 1 to 10 of 23")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Next page" }));
    expect(screen.getByText("Showing 11 to 20 of 23")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Next page" }));
    expect(names()).toHaveLength(3);
    expect(screen.getByRole("button", { name: "Next page" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Previous page" }));
    expect(screen.getByText("Page 2 of 3")).toBeInTheDocument();
  });

  it("goes back to page 1 when the page size changes", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole("button", { name: "Next page" }));
    await user.selectOptions(screen.getByLabelText("Rows per page"), "25");
    expect(screen.getByText("Showing 1 to 23 of 23")).toBeInTheDocument();
  });

  it("sorts through the server and announces it in the heading", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const header = screen.getByRole("columnheader", { name: "Total" });
    expect(header).toHaveAttribute("aria-sort", "none");
    await user.click(within(header).getByRole("button"));
    expect(header).toHaveAttribute("aria-sort", "ascending");
    expect(names()[0]).toBe("Customer A1");
    expect(screen.getByText("Sorted by Total, ascending")).toBeInTheDocument();
    await user.click(within(header).getByRole("button"));
    expect(header).toHaveAttribute("aria-sort", "descending");
    expect(names()[0]).toBe("Customer W23");
    await user.click(within(header).getByRole("button"));
    expect(header).toHaveAttribute("aria-sort", "none");
    expect(
      screen.getByRole("columnheader", { name: "Active" }),
    ).not.toHaveAttribute("aria-sort");
  });

  it("searches and filters, and clears them from the empty state", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.type(
      screen.getByRole("searchbox", { name: "Search" }),
      "customer b2",
    );
    expect(names()).toEqual(["Customer B2"]);
    await user.click(screen.getByRole("switch", { name: "Show active only" }));
    expect(
      screen.getByRole("switch", { name: "Show active only" }),
    ).toBeChecked();
    await user.clear(screen.getByRole("searchbox", { name: "Search" }));
    await user.type(screen.getByRole("searchbox", { name: "Search" }), "zzz");
    expect(await screen.findByText("No results match")).toBeInTheDocument();
    await user.click(
      screen.getByRole("button", { name: "Clear search and filters" }),
    );
    expect(names()).toHaveLength(10);
    expect(screen.getByRole("searchbox", { name: "Search" })).toHaveValue("");
  });

  it("renders a custom filter in the slot", async () => {
    const user = userEvent.setup();
    const onQueryChange = vi.fn();
    render(
      <Harness
        onQueryChange={onQueryChange}
        filterSlot={({ setFilter }) => (
          <button
            type="button"
            onClick={() => {
              setFilter("region", "north");
            }}
          >
            North
          </button>
        )}
      />,
    );
    await user.click(screen.getByRole("button", { name: "North" }));
    expect(onQueryChange).toHaveBeenCalledWith(
      expect.objectContaining({ page: 1, filters: { region: "north" } }),
    );
  });
});

describe("DataTable does not do the server's work", () => {
  it("keeps the rows it was given in the order it got them, and asks for a sort", async () => {
    const user = userEvent.setup();
    const onQueryChange = vi.fn();
    const rows = ALL.filter((_, i) => [5, 1, 9].includes(i));
    render(
      <DataTable
        tableId="fixed"
        caption="Fixed"
        columns={columns}
        rows={rows}
        total={300}
        query={{ ...DEFAULT_QUERY, page: 3 }}
        onQueryChange={onQueryChange}
        rowKey={(r) => r.id}
      />,
    );
    const before = names();
    await user.click(screen.getByRole("button", { name: "Customer" }));
    expect(onQueryChange).toHaveBeenCalledWith({
      ...DEFAULT_QUERY,
      page: 1,
      sort: { columnId: "name", direction: "asc" },
    });
    expect(names()).toEqual(before);
    expect(screen.getByText("Showing 21 to 30 of 300")).toBeInTheDocument();
  });
});

describe("column settings and saved filters (per viewer, kept in the browser)", () => {
  it("hides a column by default, shows it on request, and remembers", async () => {
    const user = userEvent.setup();
    const { unmount } = render(<Harness />);
    expect(
      screen.queryByRole("columnheader", { name: "Internal note" }),
    ).toBeNull();
    await user.click(screen.getByRole("button", { name: "Columns" }));
    expect(
      screen.queryByRole("menuitemcheckbox", { name: "Customer" }),
    ).toBeNull();
    await user.click(
      screen.getByRole("menuitemcheckbox", { name: "Internal note" }),
    );
    await user.click(screen.getByRole("menuitemcheckbox", { name: "Active" }));
    await user.keyboard("{Escape}");
    expect(
      screen.getByRole("columnheader", { name: "Internal note" }),
    ).toBeVisible();
    expect(screen.queryByRole("columnheader", { name: "Active" })).toBeNull();

    unmount();
    render(<Harness />);
    expect(
      screen.getByRole("columnheader", { name: "Internal note" }),
    ).toBeVisible();
    expect(screen.queryByRole("columnheader", { name: "Active" })).toBeNull();
  });

  it("saves a filter, survives a reload, applies it, and keeps viewers apart", async () => {
    const user = userEvent.setup();
    const { unmount } = render(<Harness />);
    await user.type(
      screen.getByRole("searchbox", { name: "Search" }),
      "customer b",
    );
    await user.click(screen.getByRole("switch", { name: "Show active only" }));
    await user.click(screen.getByRole("button", { name: "Saved filters" }));
    await user.type(screen.getByLabelText("Name for this filter"), "Active Bs");
    await user.click(
      screen.getByRole("button", { name: "Save current filter" }),
    );
    expect(
      screen.getByRole("button", { name: "Apply Active Bs" }),
    ).toBeVisible();
    unmount();

    // A reload: a fresh tree, same browser storage.
    render(<Harness />);
    expect(names()).toHaveLength(10);
    await user.click(screen.getByRole("button", { name: "Saved filters" }));
    await user.click(screen.getByRole("button", { name: "Apply Active Bs" }));
    expect(screen.getByRole("searchbox", { name: "Search" })).toHaveValue(
      "customer b",
    );
    expect(
      screen.getByRole("switch", { name: "Show active only" }),
    ).toBeChecked();
    await user.click(screen.getByRole("button", { name: "Delete Active Bs" }));
    expect(screen.getByText("No saved filters yet.")).toBeVisible();
  });

  it("does not show one viewer's saved filters to another", async () => {
    const user = userEvent.setup();
    const first = render(<Harness />);
    await user.click(screen.getByRole("button", { name: "Saved filters" }));
    await user.type(screen.getByLabelText("Name for this filter"), "Mine");
    await user.click(
      screen.getByRole("button", { name: "Save current filter" }),
    );
    first.unmount();

    useSessionStore.getState().setSession(sessionFor("FINANCE"));
    render(<Harness />);
    await user.click(screen.getByRole("button", { name: "Saved filters" }));
    expect(screen.getByText("No saved filters yet.")).toBeVisible();
  });
});

describe("every state", () => {
  const base = { rows: [], total: 0 };

  it("loading shows placeholder rows that do not pulse", () => {
    const { container } = render(<Harness {...base} status="loading" />);
    expect(container.querySelector("table")).toHaveAttribute(
      "aria-busy",
      "true",
    );
    expect(container.querySelectorAll(".animate-none").length).toBeGreaterThan(
      0,
    );
    expect(container.querySelector(".animate-pulse")).toBeNull();
  });

  it("empty offers a next action", () => {
    render(
      <DataTable
        {...base}
        tableId="e"
        caption="Customers"
        columns={columns}
        query={DEFAULT_QUERY}
        onQueryChange={() => undefined}
        rowKey={(r) => r.id}
        empty={{
          title: "No customers yet",
          action: <button type="button">Add a customer</button>,
        }}
      />,
    );
    expect(screen.getByText("No customers yet")).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Add a customer" }),
    ).toBeVisible();
    expect(screen.getByText("No rows")).toBeVisible();
  });

  it("error shows the trace id and retries", async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    render(
      <Harness
        {...base}
        status="error"
        error={new ApiError("UPSTREAM_UNAVAILABLE", "x", 502, "trace-77")}
        onRetry={onRetry}
      />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent("trace-77");
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(onRetry).toHaveBeenCalled();
  });

  it("permission denied replaces the rows", () => {
    render(<Harness {...base} status="forbidden" />);
    expect(screen.getByText("You do not have access to this")).toBeVisible();
  });

  it("partial keeps the rows and warns", () => {
    render(<Harness partialNotice="Prices could not be loaded." />);
    expect(screen.getByText(/Prices could not be loaded/)).toBeVisible();
    expect(names()).toHaveLength(10);
  });

  it("has no accessibility violations, ready or in error", async () => {
    const { container, rerender } = render(<Harness />);
    expect(await axeViolations(container)).toEqual([]);
    rerender(<Harness {...base} status="error" error={new Error("x")} />);
    expect(await axeViolations(container)).toEqual([]);
  });
});

describe("export", () => {
  it("downloads a CSV of the columns on screen, with formulas neutralised", async () => {
    const user = userEvent.setup();
    const create = vi.fn(() => "blob:test");
    vi.stubGlobal("URL", { createObjectURL: create, revokeObjectURL: vi.fn() });
    const rows: Row[] = [{ id: "x", name: "=cmd()", active: true, total: 5 }];
    render(
      <DataTable
        tableId="x"
        caption="Customers"
        columns={columns}
        rows={rows}
        total={1}
        query={DEFAULT_QUERY}
        onQueryChange={() => undefined}
        rowKey={(r) => r.id}
        exportOptions={{ fileName: "customers" }}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Export" }));
    expect(screen.getByText("Exports the rows on this page.")).toBeVisible();
    await user.click(screen.getByRole("menuitem", { name: "Export as CSV" }));
    await waitFor(() => {
      expect(create).toHaveBeenCalled();
    });
    const calls = create.mock.calls as unknown as [Blob][];
    const blob = calls[0]?.[0];
    if (!blob) throw new Error("no file was made");
    const text = await blob.text();
    expect(text).toContain("Customer,Total,Active");
    expect(text).toContain("'=cmd(),5,true");
    expect(text).not.toContain("Internal note");
  });

  it("fetches every matching row when the page supplies loadRows", async () => {
    const user = userEvent.setup();
    const create = vi.fn(() => "blob:test");
    vi.stubGlobal("URL", { createObjectURL: create, revokeObjectURL: vi.fn() });
    const loadRows = vi.fn().mockResolvedValue(ALL);
    render(<Harness exportOptions={{ fileName: "customers", loadRows }} />);
    await user.click(screen.getByRole("button", { name: "Export" }));
    expect(screen.queryByText("Exports the rows on this page.")).toBeNull();
    await user.click(screen.getByRole("menuitem", { name: "Export as CSV" }));
    await waitFor(() => {
      expect(loadRows).toHaveBeenCalled();
    });
  });

  it("builds the Excel file lazily and says when it fails", async () => {
    const user = userEvent.setup();
    const loadRows = vi.fn().mockRejectedValue(new Error("down"));
    render(<Harness exportOptions={{ fileName: "customers", loadRows }} />);
    await user.click(screen.getByRole("button", { name: "Export" }));
    await user.click(screen.getByRole("menuitem", { name: "Export as Excel" }));
    expect(
      await screen.findByText("The export failed. Try again."),
    ).toBeInTheDocument();
  });
});
