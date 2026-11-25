import { fireEvent, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderPicker } from "./availabilityTestKit";

// Not loadPicker(): the menu's code has not arrived, so the trigger is the
// shell's stand-in, which opens the menu on the click and not on the press.
// This file runs cold on purpose, and holds one test for that reason.

describe("the stand-in trigger and the opening press", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("keeps the press that the stand-in was given, as the real trigger does", async () => {
    const onPick = vi.fn();
    renderPicker({ onPick });
    const standIn = screen.getByRole("button", { name: /^Your availability/ });
    // Radix gives its trigger an id; the stand-in has none.
    expect(standIn.id).toBe("");
    const now = vi.spyOn(performance, "now").mockReturnValue(5_000_000);
    const at = { clientX: 100, clientY: 100, pointerType: "mouse" };
    fireEvent.pointerDown(standIn, { ...at, button: 0 });
    fireEvent.pointerUp(standIn, at);
    fireEvent.click(standIn, { ...at, detail: 1 });
    const menu = await screen.findByRole("menu");
    now.mockReturnValue(5_000_400);
    const first = within(menu).getByRole("menuitemradio", {
      name: "Available",
    });
    fireEvent.pointerDown(first, at);
    fireEvent.pointerUp(first, at);
    fireEvent.click(first, { ...at, detail: 1 });
    expect(onPick).not.toHaveBeenCalled();
    expect(screen.getByRole("menu")).toBeVisible();
  });
});
