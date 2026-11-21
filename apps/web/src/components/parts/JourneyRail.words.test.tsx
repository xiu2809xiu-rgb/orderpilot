import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, describe, expect, it } from "vitest";
import i18n from "@/i18n";
import { axeViolations } from "@/test/axe";
import { JourneyRail } from "./JourneyRail";

// The long forms of the abbreviations in the step names. The step's text and
// name stay what they were: other tests find a step by its words.

beforeAll(async () => {
  await i18n.loadNamespaces(["directions-parts", "components"]);
});

/** The list item at a position, or a failure that says so. */
function step(at: number): HTMLElement {
  const item = screen.getAllByRole("listitem")[at];
  if (!item) throw new Error(`No step at ${String(at)}`);
  return item;
}

describe("the step names of the full rail", () => {
  it("keep their whole text in one element and add the long form as a description", () => {
    render(<JourneyRail flow="sales" size="full" current={4} />);
    const name = screen.getByText("PO received");
    expect(name.tagName).toBe("ABBR");
    expect(name).toHaveAccessibleDescription(
      /^Purchase order\. The document a buyer sends to order goods\.$/,
    );
    // The name of the step is its words, as before.
    expect(step(0)).toHaveTextContent("PO received");
  });

  it("explain every word of a step that has two", () => {
    render(<JourneyRail flow="sales" size="full" current={9} />);
    const name = screen.getByText("AWB/BL and permit");
    expect(name.tagName).toBe("ABBR");
    expect(name).toHaveAccessibleDescription(/AWB: Air waybill\./);
    expect(name).toHaveAccessibleDescription(/BL: Bill of lading\./);
  });

  it("leave a step with no abbreviation as plain text", () => {
    render(<JourneyRail flow="sales" size="full" current={4} />);
    expect(step(1).querySelector("abbr")).toBeNull();
  });

  it("cover the purchase steps too", () => {
    render(<JourneyRail flow="purchase" size="full" current={2} />);
    for (const label of [
      "SPR raised",
      "SPR approved",
      "Vendor PO created",
      "Vendor PI received",
    ]) {
      expect(screen.getByText(label).tagName).toBe("ABBR");
    }
    expect(screen.getByText("Vendor paid").tagName).toBe("SPAN");
  });

  it("reach a keyboard, and show the long form on focus and put it away on Escape", async () => {
    const user = userEvent.setup();
    render(<JourneyRail flow="sales" size="full" current={4} />);
    await user.tab();
    const first = screen.getByText("PO received");
    expect(first).toHaveFocus();
    expect(await screen.findByRole("tooltip")).toHaveTextContent(
      "Purchase order",
    );
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("tooltip")).toBeNull();
  });

  it("show the long form when the pointer rests on a step of the vertical rail", async () => {
    const user = userEvent.setup();
    render(<JourneyRail flow="sales" size="vertical" current={4} />);
    await user.hover(screen.getByText("PI generated and sent"));
    expect(await screen.findByRole("tooltip")).toHaveTextContent(
      "Proforma invoice",
    );
  });

  it("have no accessibility violations", async () => {
    const { container } = render(
      <JourneyRail flow="sales" size="full" current={4} />,
    );
    expect(await axeViolations(container)).toEqual([]);
  });
});

describe("the current step of a row's rail", () => {
  it("is described but is not a tab stop, so a list gains none per row", async () => {
    const user = userEvent.setup();
    render(<JourneyRail flow="sales" size="row" current={3} />);
    const now = screen.getByText("PI generated and sent");
    expect(now.tagName).toBe("ABBR");
    expect(now).not.toHaveAttribute("tabindex");
    expect(now).toHaveAccessibleDescription(/^Proforma invoice\./);
    await user.tab();
    expect(document.body).toHaveFocus();
  });

  it("keeps the words that a screen reader reads for each tick", () => {
    render(<JourneyRail flow="sales" size="row" current={3} />);
    expect(
      screen.getByText("Step 3 of 9: PI generated and sent, Now"),
    ).toBeInTheDocument();
  });

  it("shows the long form on hover", async () => {
    const user = userEvent.setup();
    render(<JourneyRail flow="sales" size="row" current={9} />);
    await user.hover(screen.getByText("AWB/BL and permit"));
    expect(await screen.findByRole("tooltip")).toHaveTextContent(
      "Bill of lading",
    );
  });

  it("is plain text when the step has no abbreviation", () => {
    render(<JourneyRail flow="sales" size="row" current={2} />);
    expect(screen.getByText("Stock checked").tagName).not.toBe("ABBR");
  });
});

describe("a step name inside a link", () => {
  it("is described without a second tab stop", async () => {
    const user = userEvent.setup();
    render(
      <a href="/orders/SO-1">
        {/* A rail in a link, as a caller may put it: its words are not focusable. */}
        <JourneyRail flow="sales" size="row" current={1} />
      </a>,
    );
    const now = screen.getByText("PO received");
    expect(now).toHaveAccessibleDescription(/^Purchase order\./);
    await user.tab();
    expect(screen.getByRole("link")).toHaveFocus();
    await user.tab();
    expect(document.body).toHaveFocus();
  });
});
