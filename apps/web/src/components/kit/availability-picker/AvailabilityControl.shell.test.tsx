import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { dropdownMenuModule } from "@/app/shell/overlays/dropdown-menu";
import { renderPicker } from "./availabilityTestKit";

// A file of its own: the shell's menu code has not been loaded by an earlier
// test here. It fails to arrive until a test lets it through, and the picker's
// own chunk loads at once.
const real = dropdownMenuModule.load.bind(dropdownMenuModule);
let failing = true;
const load = vi.spyOn(dropdownMenuModule, "load").mockImplementation(() => {
  if (failing) return Promise.reject(new Error("the menu did not arrive"));
  return real();
});

afterEach(() => {
  failing = true;
  load.mockClear();
});

const trigger = () =>
  screen.getByRole("button", { name: /^Your availability/ });
const quiet = () => new Promise((resolve) => setTimeout(resolve, 150));

describe("a shell menu whose code fails to load", () => {
  it("tells a parent that owns the open state that the menu is closed", async () => {
    const onOpenChange = vi.fn();
    renderPicker({ open: true, onOpenChange });
    await waitFor(() => {
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("closes the menu, does not open it by itself when the code arrives later, and opens it on the next press", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    renderPicker({ onOpenChange });
    await user.click(trigger());
    await waitFor(() => {
      expect(onOpenChange).toHaveBeenLastCalledWith(false);
    });
    failing = false;
    await dropdownMenuModule.load();
    await quiet();
    expect(screen.queryByRole("menu")).toBeNull();
    expect(trigger()).toHaveAttribute("aria-expanded", "false");
    await user.click(trigger());
    expect(
      await screen.findByRole("menu", undefined, { timeout: 8000 }),
    ).toBeVisible();
  });
});
