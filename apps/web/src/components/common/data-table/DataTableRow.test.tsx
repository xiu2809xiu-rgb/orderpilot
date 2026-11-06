import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useLocation } from "react-router";
import { describe, expect, it } from "vitest";
import { DataTable } from "./DataTable";
import { DEFAULT_QUERY, type DataTableColumn } from "./types";

interface Row {
  id: string;
  name: string;
  href: string | undefined;
}

const columns: DataTableColumn<Row>[] = [
  { id: "name", header: "Task", cell: (r) => r.name, hideable: false },
];
const rows: Row[] = [
  { id: "a", name: "Has a page", href: "/records/a" },
  { id: "b", name: "Has no page", href: undefined },
];

function Where() {
  return <p data-testid="where">{useLocation().pathname}</p>;
}

describe("a row with a record page", () => {
  it("opens the page on a click, and a row without one does nothing", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={["/list"]}>
        <DataTable<Row>
          tableId="rows"
          caption="Tasks"
          columns={columns}
          rows={rows}
          total={rows.length}
          query={DEFAULT_QUERY}
          onQueryChange={() => undefined}
          rowKey={(r) => r.id}
          rowHref={(r) => r.href}
        />
        <Where />
      </MemoryRouter>,
    );
    const withPage = screen.getByRole("row", { name: /Has a page/ });
    const withoutPage = screen.getByRole("row", { name: /Has no page/ });
    expect(withPage).toHaveClass("cursor-pointer");
    expect(withoutPage).not.toHaveClass("cursor-pointer");

    await user.click(screen.getByText("Has no page"));
    expect(screen.getByTestId("where")).toHaveTextContent("/list");
    await user.click(screen.getByText("Has a page"));
    await waitFor(() => {
      expect(screen.getByTestId("where")).toHaveTextContent("/records/a");
    });
  });
});
