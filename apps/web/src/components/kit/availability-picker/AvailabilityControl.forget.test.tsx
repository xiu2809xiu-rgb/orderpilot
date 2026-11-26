import { fireEvent, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { loadPicker, renderPicker } from "./availabilityTestKit";
import { markOpened, msSinceOpened, repeatsOpeningPress } from "./openingPress";

loadPicker();

describe("the opening press and the control that took it", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("is forgotten when the control leaves the page, so the next render's press is not held back by it", async () => {
    vi.spyOn(performance, "now").mockReturnValue(7_000_000);
    const at = { clientX: 40, clientY: 40, pointerType: "mouse" };
    const first = renderPicker();
    const trigger = screen.getByRole("button", { name: /^Your availability/ });
    fireEvent.pointerDown(trigger, { ...at, button: 0 });
    // A press repeats only within an opening, so wait for the menu to open.
    await screen.findByRole("menu");
    expect(repeatsOpeningPress(at), "while the control is there").toBe(true);
    first.unmount();
    // A neighbour's menu opens: the press must not be there for it to repeat.
    markOpened();
    expect(repeatsOpeningPress(at), "after it has gone").toBe(false);
  });

  it("forgets when its menu opened as well, so a neighbour's choices do not count from it", () => {
    const view = renderPicker({ defaultOpen: true });
    expect(msSinceOpened(), "while the control is there").toBeLessThan(10_000);
    view.unmount();
    expect(msSinceOpened(), "after it has gone").toBe(Infinity);
  });
});
