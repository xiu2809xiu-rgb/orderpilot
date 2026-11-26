import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  holdFoldingPills,
  loadPicker,
  renderPicker,
} from "./availabilityTestKit";

loadPicker();

// The windows of the opening-press model, in the numbers ADR 0070 names (250
// ms, 500 ms, 1000 ms) and not through the constants, so that changing one of
// them fails a test. The clock is held: "400 ms later" is exact, and each test
// starts a long way after the last one so that the press an earlier test left
// has expired by its own time.

const trigger = () =>
  screen.getByRole("button", { name: /^Your availability/ });
const item = (name: string) =>
  within(screen.getByRole("menu")).getByRole("menuitemradio", { name });

let epoch = 50_000_000;
function clock() {
  epoch += 100_000;
  const now = vi.spyOn(performance, "now").mockReturnValue(epoch);
  return (ms: number) => now.mockReturnValue(epoch + ms);
}
afterEach(() => {
  vi.restoreAllMocks();
});

const at = (x: number, y: number) => ({
  clientX: x,
  clientY: y,
  pointerType: "mouse",
});
/** A press, a release and the click that follows, as a mouse sends them. */
function tap(target: Element, x: number, y: number) {
  fireEvent.pointerDown(target, at(x, y));
  fireEvent.pointerUp(target, at(x, y));
  fireEvent.click(target, { ...at(x, y), detail: 1 });
}
function openByPress(x: number, y: number) {
  fireEvent.pointerDown(trigger(), { button: 0, ...at(x, y) });
}

describe("the windows of the opening-press model", () => {
  it("refuses a press at the opening place at 450 ms and takes one at 550 ms", async () => {
    const onPick = vi.fn();
    renderPicker({ onPick });
    const goTo = clock();
    openByPress(100, 100);
    await screen.findByRole("menu");
    goTo(450);
    tap(item("Available"), 100, 100);
    expect(onPick).not.toHaveBeenCalled();
    // The refused press at 450 ms restarted the half second: wait it out.
    goTo(450 + 550);
    tap(item("Available"), 100, 100);
    expect(onPick).toHaveBeenCalledTimes(1);
  });

  it("does not let a press far from the opening press restart the half second", async () => {
    const onPick = vi.fn();
    renderPicker({ onPick });
    const goTo = clock();
    openByPress(100, 100);
    await screen.findByRole("menu");
    // Too soon to be a choice, and nowhere near the opening press.
    goTo(200);
    tap(item("Available"), 300, 300);
    expect(onPick).not.toHaveBeenCalled();
    // 650 ms after the opening press, and 450 ms after that one: the opening
    // press is the only one that a repeat is measured from.
    goTo(650);
    tap(item("Available"), 100, 100);
    expect(onPick).toHaveBeenCalledTimes(1);
  });

  it("refuses a pointer's click with no press up to 900 ms after the opening and takes one at 1100 ms", async () => {
    const onPick = vi.fn();
    renderPicker({ onPick });
    const goTo = clock();
    trigger().focus();
    fireEvent.keyDown(trigger(), { key: "Enter" });
    await screen.findByRole("menu");
    const choice = item("Focusing");
    goTo(900);
    fireEvent.click(choice, { ...at(5, 5), detail: 1 });
    expect(onPick).not.toHaveBeenCalled();
    goTo(1100);
    fireEvent.click(choice, { ...at(5, 5), detail: 1 });
    expect(onPick).toHaveBeenCalledTimes(1);
  });

  it("takes a press at 300 ms after a keyboard opening, which is past the quarter second", async () => {
    const onPick = vi.fn();
    renderPicker({ onPick });
    const goTo = clock();
    trigger().focus();
    fireEvent.keyDown(trigger(), { key: "Enter" });
    await screen.findByRole("menu");
    goTo(240);
    tap(item("Available"), 5, 5);
    expect(onPick, "at 240 ms").not.toHaveBeenCalled();
    goTo(300);
    tap(item("Available"), 5, 5);
    expect(onPick, "at 300 ms").toHaveBeenCalledTimes(1);
  });
});

describe("what a choice keeps of a press", () => {
  it("forgets a press that the browser cancelled, so a click with no press is refused again", async () => {
    const onPick = vi.fn();
    renderPicker({ onPick });
    const goTo = clock();
    trigger().focus();
    fireEvent.keyDown(trigger(), { key: "Enter" });
    await screen.findByRole("menu");
    const choice = item("Focusing");
    goTo(400);
    fireEvent.pointerDown(choice, at(5, 5));
    fireEvent.pointerCancel(choice, at(5, 5));
    // Still in the first second, and this click has no press behind it.
    goTo(500);
    fireEvent.click(choice, { ...at(5, 5), detail: 1 });
    expect(onPick).not.toHaveBeenCalled();
    expect(screen.getByRole("menu")).toBeVisible();
  });

  it("forgets its press when it is picked, so the same pill opened again refuses a click with no press", async () => {
    holdFoldingPills();
    const onPick = vi.fn();
    renderPicker({ onPick });
    const goTo = clock();
    trigger().focus();
    fireEvent.keyDown(trigger(), { key: "Enter" });
    await screen.findByRole("menu");
    const choice = item("Focusing");
    goTo(400);
    tap(choice, 5, 5);
    expect(onPick).toHaveBeenCalledTimes(1);
    const opener = () =>
      screen.getByRole("button", { name: /^Your availability/, hidden: true });
    await waitFor(() => {
      expect(opener()).toHaveAttribute("aria-expanded", "false");
    });
    // The same pill, folding.
    expect(choice.isConnected).toBe(true);
    goTo(450);
    opener().focus();
    fireEvent.keyDown(opener(), { key: "Enter" });
    await waitFor(() => {
      expect(opener()).toHaveAttribute("aria-expanded", "true");
    });
    expect(choice.isConnected).toBe(true);
    // The first second of the new opening, a click that no press led to.
    goTo(500);
    fireEvent.click(choice, { ...at(5, 5), detail: 1 });
    expect(onPick).toHaveBeenCalledTimes(1);
  });
});

describe("a press on the trigger while a save is in flight", () => {
  it("opens no menu, however it is made", async () => {
    vi.restoreAllMocks();
    renderPicker({ busy: true });
    await userEvent.setup().click(trigger());
    fireEvent.pointerDown(trigger(), { button: 0, ...at(10, 10) });
    await new Promise((resolve) => setTimeout(resolve, 150));
    expect(screen.queryByRole("menu")).toBeNull();
    expect(trigger()).toHaveAttribute("aria-expanded", "false");
  });
});
