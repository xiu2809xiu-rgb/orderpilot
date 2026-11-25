import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { loadPicker, renderPicker } from "./availabilityTestKit";
import { REPEAT_REACH_PX, REPEAT_WINDOW_MS } from "./openingPress";
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

// The opening press said again (openingPress.ts). The clock is held, so that
// "400 ms later" is exact; each test starts a long way after the last one, so
// that the press kept by an earlier test has expired by its own time.
describe("a press that repeats the opening press", () => {
  let epoch = 1_000_000;
  const clock = () => {
    epoch += 100_000;
    const now = vi.spyOn(performance, "now").mockReturnValue(epoch);
    return (ms: number) => now.mockReturnValue(epoch + ms);
  };
  afterEach(() => {
    vi.restoreAllMocks();
  });

  const press = (target: Element, x: number, y: number, type = "mouse") => ({
    target,
    x,
    y,
    type,
  });
  /** A press, a release and the click that follows, as a pointer sends them. */
  const tap = (at: ReturnType<typeof press>) => {
    const init = {
      clientX: at.x,
      clientY: at.y,
      pointerType: at.type,
    };
    fireEvent.pointerDown(at.target, init);
    fireEvent.pointerUp(at.target, init);
    fireEvent.click(at.target, { ...init, detail: 1 });
  };
  const openByPress = (x: number, y: number, type = "mouse") => {
    fireEvent.pointerDown(trigger(), {
      button: 0,
      clientX: x,
      clientY: y,
      pointerType: type,
    });
  };

  it("picks nothing at the same place 400 ms after the opening press, and the menu stays open", async () => {
    const onPick = vi.fn();
    renderPicker({ onPick });
    const goTo = clock();
    openByPress(100, 100);
    await screen.findByRole("menu");
    goTo(400);
    tap(press(item("Available"), 100, 100));
    expect(onPick).not.toHaveBeenCalled();
    expect(screen.getByRole("menu")).toBeVisible();
  });

  it("picks once at a place 60 px away 400 ms after the opening press", async () => {
    const onPick = vi.fn();
    renderPicker({ onPick });
    const goTo = clock();
    openByPress(100, 100);
    await screen.findByRole("menu");
    goTo(400);
    tap(press(item("Available"), 160, 100));
    expect(onPick).toHaveBeenCalledTimes(1);
  });

  it("picks once at the same place 600 ms after the opening press", async () => {
    const onPick = vi.fn();
    renderPicker({ onPick });
    const goTo = clock();
    openByPress(100, 100);
    await screen.findByRole("menu");
    goTo(REPEAT_WINDOW_MS + 100);
    tap(press(item("Available"), 100, 100));
    expect(onPick).toHaveBeenCalledTimes(1);
  });

  it("picks once 400 ms after a keyboard opening, wherever the press is", async () => {
    const onPick = vi.fn();
    renderPicker({ onPick });
    const goTo = clock();
    await open();
    goTo(400);
    tap(press(item("Available"), 0, 0));
    expect(onPick).toHaveBeenCalledTimes(1);
  });

  it("holds back a finger's second tap 15 px from the first, and not one 60 px away", async () => {
    const onPick = vi.fn();
    renderPicker({ onPick });
    const goTo = clock();
    openByPress(100, 100, "touch");
    await screen.findByRole("menu");
    goTo(400);
    expect(15).toBeLessThanOrEqual(REPEAT_REACH_PX.touch);
    tap(press(item("Available"), 115, 100, "touch"));
    expect(onPick).not.toHaveBeenCalled();
    expect(screen.getByRole("menu")).toBeVisible();
    tap(press(item("Available"), 160, 100, "touch"));
    expect(onPick).toHaveBeenCalledTimes(1);
  });

  it("holds back a mouse 6 px from the opening press and not 15 px, which is more than a hand's tremor", async () => {
    const onPick = vi.fn();
    renderPicker({ onPick });
    const goTo = clock();
    openByPress(100, 100);
    await screen.findByRole("menu");
    goTo(400);
    tap(press(item("Available"), 106, 100));
    expect(onPick).not.toHaveBeenCalled();
    tap(press(item("Available"), 115, 100));
    expect(onPick).toHaveBeenCalledTimes(1);
  });

  it("holds nothing back when the pill is opened by the keyboard a second after an opening press", async () => {
    const onPick = vi.fn();
    renderPicker({ onPick });
    const goTo = clock();
    openByPress(100, 100);
    await screen.findByRole("menu");
    fireEvent.keyDown(screen.getByRole("menu"), { key: "Escape" });
    await waitFor(() => {
      expect(screen.queryByRole("menu")).toBeNull();
    });
    goTo(1000);
    await open();
    goTo(1000 + 400);
    tap(press(item("Available"), 100, 100));
    expect(onPick).toHaveBeenCalledTimes(1);
  });

  it("does not keep a press that the control held because a save is in flight", async () => {
    const onPick = vi.fn();
    const view = renderPicker({ onPick, busy: true });
    const goTo = clock();
    openByPress(100, 100);
    expect(screen.queryByRole("menu")).toBeNull();
    view.unmount();
    renderPicker({ onPick });
    goTo(100);
    await open();
    goTo(400);
    tap(press(item("Available"), 100, 100));
    expect(onPick).toHaveBeenCalledTimes(1);
  });

  it("does not keep a press with the control key, which Radix does not turn into an opening", async () => {
    const onPick = vi.fn();
    renderPicker({ onPick });
    const goTo = clock();
    fireEvent.pointerDown(trigger(), {
      button: 0,
      ctrlKey: true,
      clientX: 100,
      clientY: 100,
    });
    expect(screen.queryByRole("menu")).toBeNull();
    goTo(50);
    await open();
    goTo(400);
    tap(press(item("Available"), 100, 100));
    expect(onPick).toHaveBeenCalledTimes(1);
  });

  it("does not keep a press that closes the menu, which Radix does not turn into an opening", async () => {
    const onPick = vi.fn();
    renderPicker({ onPick });
    const goTo = clock();
    await open();
    // The menu is open, and its trigger is hidden from the tree: this press closes it.
    fireEvent.pointerDown(
      screen.getByRole("button", { name: /^Your availability/, hidden: true }),
      { button: 0, clientX: 100, clientY: 100 },
    );
    await waitFor(() => {
      expect(screen.queryByRole("menu")).toBeNull();
    });
    goTo(50);
    await open();
    goTo(400);
    tap(press(item("Available"), 100, 100));
    expect(onPick).toHaveBeenCalledTimes(1);
  });
});
