import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PageHeader } from "@/components/common";
import { DataTable } from "@/components/common/data-table/DataTable";
import { DEFAULT_QUERY } from "@/components/common/data-table/types";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useGlobalShortcuts } from "./shortcuts";

function Shell({ onNew = () => undefined }: { onNew?: () => void }) {
  useGlobalShortcuts();
  return (
    <>
      <PageHeader
        title="Orders"
        primaryAction={{ label: "New order", onRun: onNew }}
      />
      <DataTable
        tableId="keys"
        caption="Orders"
        columns={[{ id: "a", header: "A", cell: () => "x" }]}
        rows={[]}
        total={0}
        query={DEFAULT_QUERY}
        onQueryChange={() => undefined}
        rowKey={() => "1"}
      />
      <input aria-label="Other field" />
    </>
  );
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("keyboard shortcuts", () => {
  it("slash focuses the page's quick search", async () => {
    render(<Shell />);
    await userEvent.keyboard("/");
    expect(screen.getByRole("searchbox", { name: "Search" })).toHaveFocus();
  });

  it("shows the hints quietly: a key label in the search box", () => {
    render(<Shell />);
    expect(screen.getByRole("searchbox")).toHaveAttribute(
      "aria-keyshortcuts",
      "/",
    );
  });

  it("N runs the page's primary action", async () => {
    const onNew = vi.fn();
    render(<Shell onNew={onNew} />);
    await userEvent.keyboard("n");
    expect(onNew).toHaveBeenCalledTimes(1);
  });

  it("does nothing while typing in a field", async () => {
    const onNew = vi.fn();
    render(<Shell onNew={onNew} />);
    await userEvent.click(screen.getByRole("textbox", { name: "Other field" }));
    await userEvent.keyboard("n/");
    expect(onNew).not.toHaveBeenCalled();
    expect(screen.getByRole("textbox", { name: "Other field" })).toHaveValue(
      "n/",
    );
  });

  it("does nothing with a modifier held", async () => {
    const onNew = vi.fn();
    render(<Shell onNew={onNew} />);
    await userEvent.keyboard("{Control>}n{/Control}");
    expect(onNew).not.toHaveBeenCalled();
  });

  it("does nothing while a dialog is open", async () => {
    const onNew = vi.fn();
    render(
      <>
        <Shell onNew={onNew} />
        <Dialog open>
          <DialogContent aria-describedby={undefined}>
            <DialogTitle>Confirm</DialogTitle>
          </DialogContent>
        </Dialog>
      </>,
    );
    await userEvent.keyboard("n/");
    expect(onNew).not.toHaveBeenCalled();
    // The dialog hides the page from the accessibility tree, so look past that.
    expect(screen.getByRole("searchbox", { hidden: true })).not.toHaveFocus();
  });

  it("leaves a page without a primary action alone", () => {
    function Bare() {
      useGlobalShortcuts();
      return <PageHeader title="Audit" />;
    }
    render(<Bare />);
    const event = new KeyboardEvent("keydown", {
      key: "n",
      bubbles: true,
      cancelable: true,
    });
    document.body.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
  });
});
