import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { axeViolations } from "@/test/axe";
import { must } from "@/test/must";
import { CountBadge } from "./CountBadge";
import { FilterChips } from "./FilterChips";
import { ToggleChip } from "./data-table/Field";

// What a unit test can say about the chip, the count and the pill without a
// layout: that the states are the same whatever moves, that the check has a
// slot that is never removed, and where focus goes. How long and how it eases
// is held by chip.css.test.ts, and how it looks is judged in a browser.

function stubReducedMotion(reduce: boolean) {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: reduce && query.includes("prefers-reduced-motion"),
    media: query,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }));
}

/**
 * The end of a CSS animation. jsdom has no AnimationEvent, so React listens
 * for the webkit-prefixed name there; a browser sends the plain one.
 */
function endAnimation(element: Element) {
  fireEvent.animationEnd(element);
  fireEvent(element, new Event("webkitAnimationEnd", { bubbles: true }));
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("the yes or no chip of the lists", () => {
  function Chip() {
    const [on, setOn] = useState(false);
    return (
      <ToggleChip checked={on} onCheckedChange={setOn}>
        Past due
      </ToggleChip>
    );
  }

  it("flips its switch when a person presses it and keeps the check, in a slot that is never removed", async () => {
    const user = userEvent.setup();
    render(<Chip />);
    const chip = screen.getByRole("switch", { name: "Past due" });
    const slot = chip.querySelector(".chip-slot");
    expect(slot).not.toBeNull();
    expect(slot).toHaveAttribute("data-on", "false");
    expect(chip).toHaveAttribute("aria-checked", "false");
    await user.click(chip);
    expect(chip).toHaveAttribute("aria-checked", "true");
    expect(chip.querySelector(".chip-slot")).toBe(slot);
    expect(slot).toHaveAttribute("data-on", "true");
    expect(slot?.querySelector("svg.lucide-check")).not.toBeNull();
    await user.click(chip);
    expect(chip).toHaveAttribute("aria-checked", "false");
    expect(chip.querySelector(".chip-slot")).toBe(slot);
    expect(slot).toHaveAttribute("data-on", "false");
  });

  it("keeps the check out of the reading order, so the switch is read by its label and state", () => {
    render(
      <ToggleChip checked onCheckedChange={vi.fn()}>
        Past due
      </ToggleChip>,
    );
    expect(
      screen
        .getByRole("switch", { name: "Past due" })
        .querySelector("[aria-hidden]"),
    ).toHaveClass("chip-slot");
  });
});

describe("the count on a Filters button", () => {
  const words = (count: number) => `${String(count)} filters are on`;

  it("bumps when its number changes, not when the page opens with it, and says the same words", () => {
    const { rerender } = render(
      <CountBadge count={1} label={words(1)} className="lp-count" />,
    );
    const first = screen.getByLabelText(words(1));
    expect(first).toHaveTextContent("1");
    expect(first).not.toHaveAttribute("data-bump");
    rerender(<CountBadge count={2} label={words(2)} className="lp-count" />);
    const second = screen.getByLabelText(words(2));
    expect(second).toHaveTextContent("2");
    expect(second).toHaveAttribute("data-bump");
    expect(second).toHaveClass("lp-count", "count-badge");
  });

  it("is nothing at 0 and bumps when it comes back", () => {
    const { rerender } = render(<CountBadge count={0} label={words(0)} />);
    expect(screen.queryByLabelText(words(0))).toBeNull();
    rerender(<CountBadge count={1} label={words(1)} />);
    expect(screen.getByLabelText(words(1))).toHaveAttribute("data-bump");
  });

  it("does not bump under reduced motion, and the number and words are the same", () => {
    stubReducedMotion(true);
    const { rerender } = render(<CountBadge count={1} label={words(1)} />);
    rerender(<CountBadge count={2} label={words(2)} />);
    const badge = screen.getByLabelText(words(2));
    expect(badge).toHaveTextContent("2");
    expect(badge).not.toHaveAttribute("data-bump");
  });
});

describe("a cleared applied-filter pill", () => {
  const IDS = ["a", "b", "c"];

  /**
   * The row as a page draws it. Without `above` nothing that takes focus
   * precedes it, as on the exceptions list and the users tab; without
   * `withClearAll` the row has no Clear all.
   */
  function Row({
    above = true,
    withClearAll = true,
  }: {
    above?: boolean;
    withClearAll?: boolean;
  }) {
    const [ids, setIds] = useState(IDS);
    return (
      <>
        {above ? <button type="button">Filters</button> : null}
        <FilterChips
          chips={ids.map((id) => ({ id, label: `Owner ${id}` }))}
          filters={Object.fromEntries(ids.map((id) => [id, "x"]))}
          onChange={(next) => {
            setIds(ids.filter((id) => id in next));
          }}
          clearAll={
            withClearAll
              ? {
                  label: "Clear all",
                  onClear: () => {
                    setIds([]);
                  },
                }
              : undefined
          }
        />
      </>
    );
  }

  const clear = (id: string) =>
    screen.getByRole("button", { name: `Clear filter: Owner ${id}` });
  const leaving = () => document.querySelectorAll("[data-leaving]");

  it("fades where it stood, leaves the DOM when the fade ends, and moves focus to the next pill", async () => {
    stubReducedMotion(false);
    const user = userEvent.setup();
    render(<Row />);
    await user.click(clear("a"));
    // The filter is off at once; what stays is a picture of the pill.
    expect(screen.queryByRole("button", { name: /Owner a/ })).toBeNull();
    expect(screen.queryByText("Owner a")).toBeNull();
    const ghost = leaving();
    expect(ghost).toHaveLength(1);
    expect(ghost[0]).toHaveAttribute("aria-hidden", "true");
    expect(ghost[0]).toHaveAttribute("inert");
    expect(clear("b")).toHaveFocus();
    endAnimation(must(ghost[0]));
    expect(leaving()).toHaveLength(0);
    expect(clear("b")).toHaveFocus();
  });

  it("moves focus to Clear all when the last of several pills goes", async () => {
    stubReducedMotion(false);
    const user = userEvent.setup();
    render(<Row />);
    await user.click(clear("c"));
    expect(screen.getByRole("button", { name: "Clear all" })).toHaveFocus();
  });

  it("moves focus up to the filters, not to the page top, when the only pill goes", async () => {
    stubReducedMotion(false);
    const user = userEvent.setup();
    render(<Row />);
    await user.click(clear("a"));
    await user.click(clear("b"));
    await user.click(clear("c"));
    expect(screen.getByRole("button", { name: "Filters" })).toHaveFocus();
    // Only ghosts are left, so the row is out of the reading order.
    expect(screen.queryByRole("list")).toBeNull();
  });

  it("goes at once under reduced motion, with the same filters and focus", async () => {
    stubReducedMotion(true);
    const user = userEvent.setup();
    render(<Row />);
    await user.click(clear("a"));
    expect(leaving()).toHaveLength(0);
    expect(within(screen.getByRole("list")).queryByText("Owner a")).toBeNull();
    expect(clear("b")).toHaveFocus();
  });

  it("stands where the pill stood, between its neighbours, while it fades", async () => {
    stubReducedMotion(false);
    const user = userEvent.setup();
    render(<Row />);
    await user.click(clear("b"));
    const items = Array.from(must(document.querySelector("ul")).children);
    expect(items.map((item) => item.hasAttribute("data-leaving"))).toEqual([
      false,
      true,
      false,
      false,
    ]);
    expect(items[0]).toHaveTextContent("Owner a");
    expect(items[2]).toHaveTextContent("Owner c");
  });

  it("drops a ghost whose animation never ends after the fallback time", () => {
    stubReducedMotion(false);
    vi.useFakeTimers();
    try {
      render(<Row />);
      fireEvent.click(clear("a"));
      expect(leaving()).toHaveLength(1);
      act(() => {
        vi.advanceTimersByTime(399);
      });
      expect(leaving()).toHaveLength(1);
      act(() => {
        vi.advanceTimersByTime(1);
      });
      expect(leaving()).toHaveLength(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it("moves focus to the previous pill when the last of several goes and there is no Clear all", async () => {
    stubReducedMotion(false);
    const user = userEvent.setup();
    render(<Row withClearAll={false} />);
    await user.click(clear("c"));
    expect(clear("b")).toHaveFocus();
  });

  it("moves focus to the page heading when only the pill goes and nothing above the row takes focus", async () => {
    stubReducedMotion(false);
    const user = userEvent.setup();
    render(
      <main>
        <h1>Exceptions</h1>
        <Row above={false} />
      </main>,
    );
    await user.click(clear("a"));
    await user.click(clear("b"));
    await user.click(clear("c"));
    expect(screen.getByRole("heading", { name: "Exceptions" })).toHaveFocus();
  });

  it("moves focus to the page heading when Clear all takes the row away and nothing above takes focus", async () => {
    stubReducedMotion(false);
    const user = userEvent.setup();
    render(
      <main>
        <h1>Users</h1>
        <Row above={false} />
      </main>,
    );
    await user.click(screen.getByRole("button", { name: "Clear all" }));
    expect(screen.getByRole("heading", { name: "Users" })).toHaveFocus();
  });

  it("has no accessibility violation with a row of pills and a ghost in it", async () => {
    stubReducedMotion(false);
    const user = userEvent.setup();
    const { container } = render(<Row />);
    await user.click(clear("a"));
    expect(leaving()).toHaveLength(1);
    expect(await axeViolations(container)).toEqual([]);
  });
});
