import { fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { loadPicker, renderPicker } from "./availabilityTestKit";

loadPicker();

const trigger = () =>
  screen.getByRole("button", { name: /^Your availability/ });

describe("a held Enter or Space on the trigger", () => {
  it.each([
    ["Enter", "Enter"],
    ["Space", " "],
  ])(
    "does not open the menu for the repeat of %s, and the first one does",
    async (_name, key) => {
      renderPicker();
      trigger().focus();
      fireEvent.keyDown(trigger(), { key, repeat: true });
      fireEvent.keyDown(trigger(), { key, repeat: true });
      expect(screen.queryByRole("menu")).toBeNull();
      expect(trigger()).toHaveAttribute("aria-expanded", "false");
      fireEvent.keyDown(trigger(), { key });
      expect(await screen.findByRole("menu")).toBeVisible();
    },
  );

  it("does not open the menu again once the first Enter has picked and the focus is back on the trigger", async () => {
    const user = userEvent.setup();
    const onPick = vi.fn();
    renderPicker({ onPick });
    trigger().focus();
    await user.keyboard("{Enter}");
    await screen.findByRole("menu");
    await waitFor(() => {
      expect(
        screen.getByRole("menuitemradio", { name: "Available" }),
      ).toHaveFocus();
    });
    // The key goes down on the checked choice and stays down.
    await user.keyboard("{Enter>}");
    await waitFor(() => {
      expect(screen.queryByRole("menu")).toBeNull();
    });
    expect(trigger()).toHaveFocus();
    expect(onPick).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(trigger(), { key: "Enter", repeat: true });
    fireEvent.keyDown(trigger(), { key: "Enter", repeat: true });
    expect(screen.queryByRole("menu")).toBeNull();
    expect(onPick).toHaveBeenCalledTimes(1);
  });

  it("still opens with ArrowDown, and a repeat of ArrowDown is harmless", async () => {
    renderPicker();
    trigger().focus();
    fireEvent.keyDown(trigger(), { key: "ArrowDown", repeat: true });
    expect(await screen.findByRole("menu")).toBeVisible();
  });
});

describe("a key on the trigger while a save is in flight", () => {
  it.each([
    ["Enter", "Enter"],
    ["Space", " "],
    ["ArrowDown", "ArrowDown"],
  ])("does not open the menu for %s", (_name, key) => {
    renderPicker({ busy: true });
    trigger().focus();
    fireEvent.keyDown(trigger(), { key });
    expect(screen.queryByRole("menu")).toBeNull();
    expect(trigger()).toHaveAttribute("aria-expanded", "false");
  });
});
