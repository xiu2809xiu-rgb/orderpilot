import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Inbox } from "lucide-react";
import { MemoryRouter, Route, Routes } from "react-router";
import { beforeAll, describe, expect, it } from "vitest";
import i18n from "@/i18n";
import { DueTimer } from "./DueTimer";
import { EmptyState } from "./EmptyState";
import { JourneyRail } from "./JourneyRail";
import { stateOf } from "./journey";
import { KpiTile } from "./KpiTile";
import { MaskedValue } from "./MaskedValue";
import { SectionHeader } from "./SectionHeader";
import { StatusTag } from "./StatusTag";

// Roles, names and words, not pixels: the test runner has no layout.

beforeAll(async () => {
  await i18n.loadNamespaces(["directions-parts"]);
});

function inPreview(ui: React.ReactNode) {
  return render(
    <MemoryRouter initialEntries={["/"]}>
      <Routes>
        <Route path="/" element={ui} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("stateOf", () => {
  it("is done before the current step, now at it, later after it", () => {
    expect([1, 2, 3, 4].map((n) => stateOf(n, 3))).toEqual([
      "done",
      "done",
      "now",
      "later",
    ]);
    expect(stateOf(9, 10)).toBe("done");
  });
});

/** The nth list item, or a failure that says so. */
function nth(items: readonly HTMLElement[], at: number): HTMLElement {
  const item = items[at];
  if (!item) throw new Error(`No list item at ${String(at)}`);
  return item;
}

describe("JourneyRail", () => {
  it("lists the nine sales steps and marks the current one", () => {
    render(<JourneyRail flow="sales" size="full" current={4} />);
    const list = screen.getByRole("list", { name: "Sales order journey" });
    const items = within(list).getAllByRole("listitem");
    expect(items).toHaveLength(9);
    expect(items[3]).toHaveAttribute("aria-current", "step");
    expect(items[0]).not.toHaveAttribute("aria-current");
    expect(within(nth(items, 0)).getByText("PO received")).toBeVisible();
    expect(within(nth(items, 0)).getByText("Done")).toBeInTheDocument();
    expect(within(nth(items, 3)).getByText("Now")).toBeInTheDocument();
    expect(within(nth(items, 8)).getByText("Later")).toBeInTheDocument();
  });

  it("says so in words when the current step is late", () => {
    render(<JourneyRail flow="sales" size="full" current={4} late />);
    expect(screen.getByText("Now, late")).toBeInTheDocument();
  });

  it("shows a caller's line under a step and still tells a screen reader its state", () => {
    render(
      <JourneyRail
        flow="sales"
        size="vertical"
        current={2}
        details={{ 2: "Waiting 2 days, usually 2 days" }}
      />,
    );
    const item = nth(screen.getAllByRole("listitem"), 1);
    expect(within(item).getByText(/Waiting 2 days/)).toBeVisible();
    expect(item).toHaveTextContent("Now: Waiting 2 days");
  });

  it("uses the nine purchase steps for a purchase order", () => {
    render(<JourneyRail flow="purchase" size="full" current={2} />);
    expect(
      screen.getByRole("list", { name: "Purchase order journey" }),
    ).toBeInTheDocument();
    expect(screen.getByText("SPR approved")).toBeInTheDocument();
    expect(screen.getByText("Vendor paid")).toBeInTheDocument();
  });

  it("is one tick per step plus the current step's name in a row", () => {
    render(<JourneyRail flow="sales" size="row" current={4} />);
    expect(screen.getAllByRole("listitem")).toHaveLength(9);
    expect(
      screen.getByText("Step 4 of 9: Payment received, Now"),
    ).toBeInTheDocument();
    // The visible name of the step the order is at.
    expect(screen.getAllByText("Payment received")).toHaveLength(1);
  });

  it("says every step is done when the order is past the last", () => {
    render(<JourneyRail flow="sales" size="row" current={10} />);
    expect(screen.getByText("All steps done")).toBeInTheDocument();
    expect(
      screen
        .getAllByRole("listitem")
        .some((li) => li.hasAttribute("aria-current")),
    ).toBe(false);
  });
});

describe("DueTimer", () => {
  const now = new Date("2026-11-13T09:00:00.000Z");
  const at = (ms: number) => new Date(now.getTime() + ms);

  it("says when a task is due, in words", () => {
    const { rerender } = render(<DueTimer due={at(3 * 3_600_000)} now={now} />);
    expect(screen.getByText("Due in 3 h")).toBeInTheDocument();
    rerender(<DueTimer due={at(45 * 60_000)} now={now} />);
    expect(screen.getByText("Due in 45 min")).toBeInTheDocument();
    rerender(<DueTimer due={at(3 * 86_400_000)} now={now} />);
    expect(screen.getByText("Due in 3 days")).toBeInTheDocument();
    rerender(<DueTimer due={at(10_000)} now={now} />);
    expect(screen.getByText("Due now")).toBeInTheDocument();
  });

  it("says how late a task is", () => {
    const { rerender } = render(
      <DueTimer due={at(-(2 * 86_400_000 + 3_600_000))} now={now} />,
    );
    expect(screen.getByText("2 days late")).toBeInTheDocument();
    rerender(<DueTimer due={at(-3_600_000)} now={now} />);
    expect(screen.getByText("1 h late")).toBeInTheDocument();
    rerender(<DueTimer due={at(-86_400_000)} now={now} />);
    expect(screen.getByText("24 h late")).toBeInTheDocument();
  });

  it("counts days late in Singapore calendar days, as the order page does", () => {
    // Due 12 Nov 17:00 in Singapore, now 15 Nov 11:00 there: 2.75 days have
    // passed, and the calendar says 3 days late.
    render(
      <DueTimer
        due={new Date("2026-11-12T09:00:00.000Z")}
        now={new Date("2026-11-15T03:00:00.000Z")}
      />,
    );
    expect(screen.getByText("3 days late")).toBeInTheDocument();
  });

  it("keeps the due time in the markup", () => {
    const { container } = render(<DueTimer due={at(3_600_000)} now={now} />);
    expect(container.querySelector("time")).toHaveAttribute(
      "datetime",
      "2026-11-13T10:00:00.000Z",
    );
  });
});

describe("StatusTag", () => {
  it("has a word for each tone", () => {
    const { rerender } = render(<StatusTag tone="ok" />);
    expect(screen.getByText("On time")).toBeInTheDocument();
    rerender(<StatusTag tone="waiting" />);
    expect(screen.getByText("Waiting")).toBeInTheDocument();
    rerender(<StatusTag tone="mismatch" />);
    expect(screen.getByText("Mismatch")).toBeInTheDocument();
    rerender(<StatusTag tone="info" />);
    expect(screen.getByText("For information")).toBeInTheDocument();
  });

  it("takes a more exact word from the caller", () => {
    render(<StatusTag tone="mismatch" label="Packing list differs" />);
    expect(screen.getByText("Packing list differs")).toBeInTheDocument();
  });
});

describe("KpiTile", () => {
  it("shows the figure and its label", () => {
    inPreview(<KpiTile label="Open orders" value={1284} unit="orders" />);
    expect(screen.getByText("Open orders")).toBeInTheDocument();
    expect(screen.getByText("1,284")).toBeInTheDocument();
    expect(screen.getByText("orders")).toBeInTheDocument();
  });

  it("shows no number when the data cannot support one", () => {
    inPreview(<KpiTile label="Approval turnaround" value={null} unit="h" />);
    expect(screen.getByText("No figure yet")).toBeInTheDocument();
    expect(screen.queryByText("h")).not.toBeInTheDocument();
  });

  it("says the trend in words, with the direction for a screen reader", () => {
    inPreview(
      <KpiTile
        label="Overdue orders"
        value={7}
        trend={{
          direction: "down",
          text: "3 fewer than last week",
          good: true,
        }}
      />,
    );
    expect(screen.getByText("3 fewer than last week")).toBeInTheDocument();
    expect(screen.getByText(/Down:/)).toBeInTheDocument();
  });
});

describe("MaskedValue", () => {
  it("never puts a masked value in the page", () => {
    const { container } = render(
      <MaskedValue
        masked
        value="48,200.00"
        reason="Prices are hidden from Warehouse"
      />,
    );
    expect(container).not.toHaveTextContent("48,200.00");
  });

  it("describes the mask with its reason", () => {
    render(<MaskedValue masked reason="Prices are hidden from Warehouse" />);
    const mask = screen.getByRole("button", { name: /Hidden/ });
    expect(mask).toHaveAccessibleDescription(
      "Hidden: Prices are hidden from Warehouse",
    );
  });

  it("shows the reason when the mask is focused", async () => {
    const user = userEvent.setup();
    render(<MaskedValue masked reason="Prices are hidden from Warehouse" />);
    await user.tab();
    expect(await screen.findByRole("tooltip")).toHaveTextContent(
      "Hidden: Prices are hidden from Warehouse",
    );
  });

  it("falls back to a plain reason when the server gave none", () => {
    render(<MaskedValue masked />);
    expect(
      screen.getByRole("button", { name: /Hidden/ }),
    ).toHaveAccessibleDescription(
      "Hidden: your role does not include this figure",
    );
  });

  it("shows an unmasked value as it is", () => {
    render(<MaskedValue masked={false} value="48,200.00" />);
    expect(screen.getByText("48,200.00")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});

describe("SectionHeader", () => {
  it("is a heading with its count and its actions", () => {
    render(
      <SectionHeader
        title="Needs you"
        count={7}
        actions={<button type="button">View all</button>}
      />,
    );
    expect(
      screen.getByRole("heading", { level: 2, name: "Needs you 7" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "View all" }),
    ).toBeInTheDocument();
  });
});

describe("EmptyState", () => {
  it("says what is empty and offers the next step", () => {
    render(
      <EmptyState
        icon={Inbox}
        title="No documents yet"
        description="Upload a PO to start."
        action={<button type="button">Upload a document</button>}
      />,
    );
    expect(screen.getByText("No documents yet")).toBeInTheDocument();
    expect(screen.getByText("Upload a PO to start.")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Upload a document" }),
    ).toBeInTheDocument();
  });
});
