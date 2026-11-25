import { fireEvent, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderPicker } from "./availabilityTestKit";
import { repeatsOpeningPress } from "./openingPress";

describe("the opening press and the control that took it", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("is forgotten when the control leaves the page, so the next render's press is not held back by it", () => {
    vi.spyOn(performance, "now").mockReturnValue(7_000_000);
    const at = { clientX: 40, clientY: 40, pointerType: "mouse" };
    const first = renderPicker();
    const trigger = screen.getByRole("button", { name: /^Your availability/ });
    fireEvent.pointerDown(trigger, { ...at, button: 0 });
    expect(repeatsOpeningPress(at), "while the control is there").toBe(true);
    first.unmount();
    expect(repeatsOpeningPress(at), "after it has gone").toBe(false);
  });
});
