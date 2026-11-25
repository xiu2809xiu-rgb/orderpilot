import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { loadPicker, renderPicker } from "./availabilityTestKit";
import { OPENING_CLICK_MS, OPEN_GUARD_MS } from "./PickerOrb";

loadPicker();

// Real pointer events, in the order a browser sends them. user.click would
// send the release to the same element it pressed, which is the one thing the
// fault is not: the pill opens under the pointer, and the release lands on a
// choice that was never pressed.

const trigger = () =>
  screen.getByRole("button", { name: /^Your availability/ });
const item = (name: string) =>
  within(screen.getByRole("menu")).getByRole("menuitemradio", { name });

async function open() {
  const user = userEvent.setup();
  trigger().focus();
  await user.keyboard("{Enter}");
  await screen.findByRole("menu");
}

/** Opens, and waits until a press on a choice counts (OPEN_GUARD_MS). */
async function openAndWait() {
  await open();
  await new Promise((resolve) => setTimeout(resolve, OPEN_GUARD_MS + 20));
}

describe("picking with the pointer", () => {
  it("does nothing for a release on a choice that was not pressed, and the menu stays open", async () => {
    const onPick = vi.fn();
    renderPicker({ onPick });
    await open();
    fireEvent.pointerUp(item("Available"));
    fireEvent.pointerUp(item("Focusing"));
    expect(onPick).not.toHaveBeenCalled();
    expect(screen.getByRole("menu")).toBeVisible();
  });

  it("picks, once, for a press and a release on the same choice", async () => {
    const onPick = vi.fn();
    renderPicker({ onPick });
    await openAndWait();
    const focusing = item("Focusing");
    fireEvent.pointerDown(focusing);
    fireEvent.pointerUp(focusing);
    // The release alone picks nothing: the browser's click does.
    expect(onPick).not.toHaveBeenCalled();
    fireEvent.click(focusing);
    expect(onPick).toHaveBeenCalledTimes(1);
    expect(onPick).toHaveBeenCalledWith("FOCUSING");
    await waitFor(() => {
      expect(screen.queryByRole("menu")).toBeNull();
    });
  });

  it("picks nothing for a press on one choice, a leave and a release on another", async () => {
    const onPick = vi.fn();
    renderPicker({ onPick });
    await open();
    fireEvent.pointerDown(item("Available"));
    fireEvent.pointerLeave(item("Available"));
    fireEvent.pointerUp(item("Do not disturb"));
    expect(onPick).not.toHaveBeenCalled();
    expect(screen.getByRole("menu")).toBeVisible();
  });

  it("picks nothing for the click that follows a finger's tap on the trigger, which lands on the choice under the finger", async () => {
    const onPick = vi.fn();
    renderPicker({ onPick });
    await open();
    // A tap presses and releases the trigger; the click that the browser sends
    // after it is made by a pointer (detail 1) and lands on a choice that the
    // finger never pressed.
    fireEvent.click(item("Focusing"), { detail: 1 });
    expect(onPick).not.toHaveBeenCalled();
    expect(screen.getByRole("menu")).toBeVisible();
  });

  it("refuses a pointer's click on a choice with no press only in the first second after the pill appears", async () => {
    const onPick = vi.fn();
    renderPicker({ onPick });
    await open();
    const choice = item("Focusing");
    const now = vi.spyOn(performance, "now");
    const start = performance.now();
    // The tap that opened the pill: its click lands here, 300 ms in, with no press.
    now.mockReturnValue(start + 300);
    fireEvent.click(choice, { detail: 1 });
    expect(onPick).not.toHaveBeenCalled();
    expect(screen.getByRole("menu")).toBeVisible();
    // An input that sends a click with no press, long after the opening.
    now.mockReturnValue(start + OPENING_CLICK_MS + 200);
    fireEvent.click(choice, { detail: 1 });
    expect(onPick).toHaveBeenCalledTimes(1);
    expect(onPick).toHaveBeenCalledWith("FOCUSING");
    now.mockRestore();
  });

  it("picks, once, for a finger's tap on a choice, whose pointerleave comes before its click", async () => {
    const onPick = vi.fn();
    renderPicker({ onPick });
    await openAndWait();
    const dnd = item("Do not disturb");
    fireEvent.pointerDown(dnd, { pointerType: "touch" });
    fireEvent.pointerUp(dnd, { pointerType: "touch" });
    fireEvent.pointerLeave(dnd, { pointerType: "touch" });
    fireEvent.click(dnd, { detail: 1 });
    expect(onPick).toHaveBeenCalledTimes(1);
    expect(onPick).toHaveBeenCalledWith("DO_NOT_DISTURB");
  });

  it("ignores a press within a quarter of a second of the pill's appearing, which is the second click of a double click", async () => {
    const onPick = vi.fn();
    renderPicker({ onPick });
    await open();
    const first = item("Available");
    const now = vi.spyOn(performance, "now");
    const start = performance.now();
    // The pill has been in the page for 100 ms: too soon to be a choice.
    now.mockReturnValue(start + 100);
    fireEvent.pointerDown(first);
    fireEvent.pointerUp(first);
    fireEvent.click(first, { detail: 1 });
    expect(onPick).not.toHaveBeenCalled();
    expect(screen.getByRole("menu")).toBeVisible();
    // Later it is a pick.
    now.mockReturnValue(start + 400);
    fireEvent.pointerDown(first);
    fireEvent.pointerUp(first);
    fireEvent.click(first, { detail: 1 });
    expect(onPick).toHaveBeenCalledTimes(1);
    now.mockRestore();
  });

  it("still picks with Enter and with Space", async () => {
    const user = userEvent.setup();
    const onPick = vi.fn();
    renderPicker({ onPick });
    await open();
    await user.keyboard("{ArrowRight}{Enter}");
    expect(onPick).toHaveBeenLastCalledWith("FOCUSING");
    await waitFor(() => {
      expect(screen.queryByRole("menu")).toBeNull();
    });
    trigger().focus();
    await user.keyboard("{Enter}");
    await screen.findByRole("menu");
    await user.keyboard("{ArrowRight} ");
    expect(onPick).toHaveBeenCalledTimes(2);
    expect(onPick).toHaveBeenLastCalledWith("DO_NOT_DISTURB");
  });
});
