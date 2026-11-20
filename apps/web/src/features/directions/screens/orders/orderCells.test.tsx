import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { FoldedFacts } from "./FoldedFacts";
import { DocsCell } from "./OrderFigures";
import { fitColumns, foldedAt } from "./orderFit";
import { orderColumns } from "./orderColumns";
import { StageCell } from "./StageCell";
import { loadNamespaces, makeRow } from "./ordersTestKit";
import i18n from "@/i18n";

beforeAll(loadNamespaces);
afterEach(() => {
  vi.unstubAllGlobals();
});

const TODAY = new Date().toISOString().slice(0, 10);

describe("the Documents cell", () => {
  it("says an open exception, not a difference, when the row only has a count", () => {
    render(<DocsCell row={makeRow({ openExceptions: 1 })} />);
    expect(screen.getByText("1 open exception")).toBeVisible();
    expect(screen.queryByText("Differs")).toBeNull();
  });

  it("says a document to confirm in its own words, beside the exceptions", () => {
    render(<DocsCell row={makeRow({ openExceptions: 2, toConfirm: true })} />);
    expect(screen.getByText("To confirm")).toBeVisible();
    expect(screen.getByText("2 open exceptions")).toBeVisible();
  });

  it("is a dash with a spoken reason when nothing needs attention", () => {
    render(<DocsCell row={makeRow()} />);
    expect(screen.getByText("No document needs attention")).toBeInTheDocument();
  });
});

describe("the Stage cell", () => {
  it("puts the age beside the late flag under the stage's words", () => {
    render(<StageCell row={makeRow()} today={TODAY} dots={false} />);
    expect(screen.getByText("Waiting for payment")).toBeVisible();
    expect(screen.getByText("14 d")).toBeVisible();
    expect(screen.getByText("3 d late")).toBeVisible();
  });

  it("says why a held order is held, from the row", () => {
    render(<StageCell row={makeRow()} today={TODAY} dots={false} />);
    expect(screen.getByText("Payment not confirmed")).toBeVisible();
  });

  it("says nothing of why for an order that is not held up", () => {
    const row = makeRow({
      overdue: { overdue: false, daysOverdue: 0, reason: null },
    });
    render(<StageCell row={row} today={TODAY} dots={false} />);
    expect(screen.queryByText("Payment not confirmed")).toBeNull();
    expect(screen.queryByText(/late/)).toBeNull();
  });

  it("draws the nine dots only where the window has room for them", () => {
    const { rerender } = render(
      <StageCell row={makeRow()} today={TODAY} dots={false} />,
    );
    expect(
      screen.queryByRole("list", { name: "Sales order journey" }),
    ).toBeNull();
    rerender(<StageCell row={makeRow()} today={TODAY} dots />);
    expect(
      screen.getByRole("list", { name: "Sales order journey" }),
    ).toBeVisible();
  });

  it("keeps the words of an order the tracker does not know", () => {
    const row = makeRow({
      step: null,
      status: null,
      workflowStatus: null,
      overdue: null,
    });
    render(<StageCell row={row} today={TODAY} dots />);
    expect(screen.getByText("Not started")).toBeVisible();
  });
});

describe("what a narrow window leaves out", () => {
  const columns = () =>
    orderColumns({
      t: i18n.getFixedT("en", "directions-orders"),
      roleLabel: (role) => role,
      today: TODAY,
      valueHidden: false,
    });

  it("keeps every default column from 1366 px up", () => {
    const shown = columns().filter((column) => !column.defaultHidden);
    expect(fitColumns(shown, "dots")).toHaveLength(shown.length);
    expect(fitColumns(shown, "full")).toHaveLength(shown.length);
  });

  it("leaves out held at, ship date and value first, then the PO number, then the documents", () => {
    const ids = (fit: Parameters<typeof fitColumns>[1]) =>
      fitColumns(
        columns().filter((column) => !column.defaultHidden),
        fit,
      ).map((column) => column.id);
    expect(ids("mid")).toEqual([
      "orderNo",
      "externalDocumentNo",
      "customerName",
      "step",
      "docs",
    ]);
    expect(ids("small")).not.toContain("externalDocumentNo");
    expect(ids("small")).toContain("docs");
    expect(ids("tiny")).toEqual(["orderNo", "customerName", "step"]);
  });

  it("keeps a column the viewer chose, such as Stock, when it is not one of the folded", () => {
    const withStock = columns().filter(
      (column) => !column.defaultHidden || column.id === "stock",
    );
    expect(fitColumns(withStock, "tiny").map((c) => c.id)).toContain("stock");
  });

  it("writes the facts of the left-out columns under the order's number", () => {
    const row = makeRow({ openExceptions: 1, shipmentDate: "2026-11-27" });
    render(
      <FoldedFacts
        row={row}
        ids={foldedAt("tiny")}
        roleLabel={() => "Finance"}
      />,
      { wrapper: MemoryRouter },
    );
    expect(screen.getByText("PO-AE-4261")).toBeVisible();
    expect(screen.getByText("Held at Finance")).toBeVisible();
    expect(screen.getByText("Ships 27 Nov 2026")).toBeVisible();
    expect(screen.getByText("7,960.80")).toBeVisible();
    expect(screen.getByText("1 open exception")).toBeVisible();
  });

  it("keeps a masked value masked under the number, with its reason", () => {
    const row = makeRow({
      amount: {
        field: "item.unitPrice",
        classification: "confidential",
        masked: true,
        value: null,
        reason: "price",
      },
    });
    const { container } = render(
      <FoldedFacts row={row} ids={["amount"]} roleLabel={() => "Finance"} />,
    );
    expect(within(container).getByText("Hidden")).toBeInTheDocument();
    expect(container.textContent).not.toContain("7,960.80");
  });
});
