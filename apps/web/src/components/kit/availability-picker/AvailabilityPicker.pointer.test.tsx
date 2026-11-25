import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { loadPicker, renderPicker } from "./availabilityTestKit";

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
    await open();
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

  it("picks, once, for a finger's tap on a choice, whose pointerleave comes before its click", async () => {
    const onPick = vi.fn();
    renderPicker({ onPick });
    await open();
    const dnd = item("Do not disturb");
    fireEvent.pointerDown(dnd, { pointerType: "touch" });
    fireEvent.pointerUp(dnd, { pointerType: "touch" });
    fireEvent.pointerLeave(dnd, { pointerType: "touch" });
    fireEvent.click(dnd, { detail: 1 });
    expect(onPick).toHaveBeenCalledTimes(1);
    expect(onPick).toHaveBeenCalledWith("DO_NOT_DISTURB");
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
