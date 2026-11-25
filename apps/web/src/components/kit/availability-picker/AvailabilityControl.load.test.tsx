import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { loadShellOverlays } from "@/app/shell/overlays/preload";
import { must } from "@/test/must";
import { pickerModule } from "./AvailabilityControl";
import { renderPicker } from "./availabilityTestKit";

// A file of its own: the picker's chunk has not been loaded by an earlier test
// here, and the loads fail until the last test lets one through (which loads
// the chunk for good, so that test stays last).
const trigger = () => must(document.querySelector<HTMLElement>(".ap-trigger"));
const faceOpacity = () =>
  getComputedStyle(must(trigger().querySelector(".ap-face"))).opacity;

const real = pickerModule.load.bind(pickerModule);
let failing = true;
const load = vi.spyOn(pickerModule, "load").mockImplementation(() => {
  if (failing) return Promise.reject(new Error("the chunk did not arrive"));
  return real();
});

beforeAll(async () => {
  await loadShellOverlays();
});

afterEach(() => {
  failing = true;
  load.mockClear();
});

async function press(user: ReturnType<typeof userEvent.setup>) {
  await user.click(trigger());
}

describe("a picker whose code fails to load", () => {
  it("tells a parent that owns the open state that the menu is closed", async () => {
    const onOpenChange = vi.fn();
    renderPicker({ open: true, onOpenChange });
    await waitFor(() => {
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
    expect(screen.queryByRole("menu")).toBeNull();
    // The parent kept `open` true here, so the control did not clear it itself.
    expect(trigger()).toHaveAttribute("aria-expanded", "true");
  });

  it("closes again, leaves the face drawn, and the next press tries again", async () => {
    const user = userEvent.setup();
    renderPicker();
    await press(user);
    await waitFor(() => {
      expect(load).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(trigger()).toHaveAttribute("aria-expanded", "false");
    });
    expect(screen.queryByRole("menu")).toBeNull();
    expect(trigger()).not.toHaveAttribute("data-pill-open");
    expect(faceOpacity()).not.toBe("0");

    failing = false;
    load.mockClear();
    await press(user);
    await screen.findByRole("menu", undefined, { timeout: 8000 });
    expect(trigger()).toHaveAttribute("aria-expanded", "true");
    expect(load).toHaveBeenCalled();
  });
});
