import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  holdFoldingPills,
  loadPicker,
  renderPicker,
} from "./availabilityTestKit";
import {
  OPENING_CLICK_MS,
  OPEN_GUARD_MS,
  REPEAT_REACH_PX,
  REPEAT_WINDOW_MS,
  markOpened,
  msSinceOpened,
  repeatsOpeningPress,
} from "./openingPress";

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
    // Counted from the opening itself, not from this moment: finding the menu
    // takes longer on a busy machine, and the windows are the opening's.
    const start = performance.now() - msSinceOpened();
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
    // Counted from the opening itself, not from this moment: finding the menu
    // takes longer on a busy machine, and the windows are the opening's.
    const start = performance.now() - msSinceOpened();
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

  it.each([
    ["Enter", "Enter"],
    ["Space", " "],
  ])(
    "picks nothing for the repeat of a held %s on the focused choice, and a first one picks",
    async (_name, key) => {
      const onPick = vi.fn();
      renderPicker({ onPick });
      await open();
      const checked = item("Available");
      await waitFor(() => {
        expect(checked).toHaveFocus();
      });
      // The key's own repeat, as the system sends it while the key stays down.
      fireEvent.keyDown(checked, { key, repeat: true });
      fireEvent.keyDown(checked, { key, repeat: true });
      expect(onPick).not.toHaveBeenCalled();
      expect(screen.getByRole("menu")).toBeVisible();
      fireEvent.keyDown(checked, { key });
      expect(onPick).toHaveBeenCalledTimes(1);
      expect(onPick).toHaveBeenCalledWith("AVAILABLE");
    },
  );
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

  it("records no opening press while a save is in flight", () => {
    renderPicker({ busy: true });
    clock();
    openByPress(100, 100);
    // A menu that opens a moment later by another way: a press that was held
    // back must not be there for it to repeat.
    markOpened();
    expect(repeatsOpeningPress({ clientX: 100, clientY: 100 })).toBe(false);
  });

  it("records no opening press for the right button", () => {
    renderPicker();
    clock();
    fireEvent.pointerDown(trigger(), {
      button: 2,
      clientX: 100,
      clientY: 100,
    });
    expect(screen.queryByRole("menu")).toBeNull();
    markOpened();
    expect(repeatsOpeningPress({ clientX: 100, clientY: 100 })).toBe(false);
  });

  it("records the press that opens the menu, which the other clauses must not hide", () => {
    renderPicker();
    clock();
    openByPress(100, 100);
    expect(repeatsOpeningPress({ clientX: 100, clientY: 100 })).toBe(true);
  });

  it("picks nothing for a press that was refused at 200 ms and held for 1.5 s, but a later press picks", async () => {
    const onPick = vi.fn();
    renderPicker({ onPick });
    const goTo = clock();
    openByPress(100, 100);
    await screen.findByRole("menu");
    const choice = item("Do not disturb");
    const at = { clientX: 300, clientY: 300, pointerType: "mouse" };
    goTo(200);
    fireEvent.pointerDown(choice, at);
    goTo(1700);
    fireEvent.pointerUp(choice, at);
    fireEvent.click(choice, { ...at, detail: 1 });
    expect(onPick).not.toHaveBeenCalled();
    expect(screen.getByRole("menu")).toBeVisible();
    tap(press(choice, 300, 300));
    expect(onPick).toHaveBeenCalledTimes(1);
  });

  it("picks nothing for the third click of a triple click, 300 ms after the second, at the opening place", async () => {
    const onPick = vi.fn();
    renderPicker({ onPick });
    const goTo = clock();
    openByPress(100, 100);
    await screen.findByRole("menu");
    goTo(300);
    tap(press(item("Available"), 100, 100));
    goTo(600);
    tap(press(item("Available"), 100, 100));
    expect(onPick).not.toHaveBeenCalled();
    expect(screen.getByRole("menu")).toBeVisible();
    // Said again after a pause of more than the half second, it is a choice.
    goTo(600 + REPEAT_WINDOW_MS + 50);
    tap(press(item("Available"), 100, 100));
    expect(onPick).toHaveBeenCalledTimes(1);
  });

  // The pill stays mounted through a close and an opening within the fold
  // (holdFoldingPills), so a choice keeps what it saw of a press.
  const opener = () =>
    screen.getByRole("button", { name: /^Your availability/, hidden: true });
  const closeAndReopen = async (
    choice: Element,
    goTo: (ms: number) => void,
    closeAt: number,
    openAt: number,
  ) => {
    goTo(closeAt);
    fireEvent.keyDown(choice, { key: "Escape" });
    await waitFor(() => {
      expect(opener()).toHaveAttribute("aria-expanded", "false");
    });
    expect(choice.isConnected).toBe(true);
    goTo(openAt);
    fireEvent.pointerDown(opener(), {
      button: 0,
      clientX: 100,
      clientY: 100,
      pointerType: "mouse",
    });
    await waitFor(() => {
      expect(opener()).toHaveAttribute("aria-expanded", "true");
    });
    expect(choice.isConnected).toBe(true);
  };
  const slidAway = { clientX: 100, clientY: 100, pointerType: "touch" };

  it("picks nothing for a click with no press on a choice whose press was slid away from in the opening before, and the next press and click pick once", async () => {
    holdFoldingPills();
    const onPick = vi.fn();
    renderPicker({ onPick });
    const goTo = clock();
    await open();
    const first = item("Available");
    // Pressed, and let go elsewhere: no click follows, so nothing clears the mark.
    goTo(400);
    fireEvent.pointerDown(first, slidAway);
    fireEvent.pointerUp(item("Focusing"), slidAway);
    expect(onPick).not.toHaveBeenCalled();
    await closeAndReopen(first, goTo, 1000, 1100);
    // The tap on the trigger sends its click to this choice, 120 ms in.
    goTo(1100 + 120);
    fireEvent.click(first, { ...slidAway, detail: 1 });
    expect(onPick).not.toHaveBeenCalled();
    expect(screen.getByRole("menu")).toBeVisible();
    // The refusal swallows nothing: a press and its click, away from the opening place.
    goTo(1100 + 300);
    tap(press(first, 300, 300));
    expect(onPick).toHaveBeenCalledTimes(1);
    expect(onPick).toHaveBeenCalledWith("AVAILABLE");
  });

  it("picks for a click with no press 1.5 s into an opening, though a press in the opening before was refused and never finished", async () => {
    holdFoldingPills();
    const onPick = vi.fn();
    renderPicker({ onPick });
    const goTo = clock();
    await open();
    const first = item("Available");
    // Too soon to be a choice, so refused; the click that would have used the mark up never came.
    goTo(100);
    fireEvent.pointerDown(first, slidAway);
    await closeAndReopen(first, goTo, 500, 600);
    goTo(600 + 1500);
    fireEvent.click(first, { ...slidAway, detail: 1 });
    expect(onPick).toHaveBeenCalledTimes(1);
    expect(onPick).toHaveBeenCalledWith("AVAILABLE");
  });

  it("picks nothing for clicks at the opening place 300, 600 and 900 ms after it, and the click at 1200 ms picks once", async () => {
    const onPick = vi.fn();
    renderPicker({ onPick });
    const goTo = clock();
    openByPress(100, 100);
    await screen.findByRole("menu");
    // Each click is within the half second of the one before, and the burst
    // is one gesture only for the first second after the opening.
    for (const at of [300, 600, 900]) {
      goTo(at);
      tap(press(item("Available"), 100, 100));
    }
    expect(onPick).not.toHaveBeenCalled();
    expect(screen.getByRole("menu")).toBeVisible();
    goTo(1200);
    tap(press(item("Available"), 100, 100));
    expect(onPick).toHaveBeenCalledTimes(1);
    expect(onPick).toHaveBeenCalledWith("AVAILABLE");
  });

  it("counts the quarter second from each opening, also when the pill stayed mounted through the fold", async () => {
    // Radix keeps a closing pill in the page until its fold ends. jsdom has no
    // animations, so the closed pill is given one, as the sheet does.
    const real = window.getComputedStyle.bind(window);
    vi.spyOn(window, "getComputedStyle").mockImplementation(
      (node, pseudo) =>
        new Proxy(real(node, pseudo), {
          get(style, name) {
            if (name === "animationName") {
              return node.getAttribute("data-state") === "closed"
                ? "ap-fold"
                : "ap-grow";
            }
            const value: unknown = Reflect.get(style, name);
            if (typeof value !== "function") return value;
            return (...args: unknown[]): unknown =>
              Reflect.apply(value, style, args);
          },
        }),
    );
    const onPick = vi.fn();
    renderPicker({ onPick });
    const goTo = clock();
    await open();
    const first = item("Available");
    // The menu's own trigger is hidden from the tree while it is open.
    const opener = () =>
      screen.getByRole("button", { name: /^Your availability/, hidden: true });
    goTo(1000);
    fireEvent.keyDown(first, { key: "Escape" });
    await waitFor(() => {
      expect(opener()).toHaveAttribute("aria-expanded", "false");
    });
    // The same pill, folding.
    expect(first.isConnected).toBe(true);
    goTo(1100);
    opener().focus();
    fireEvent.keyDown(opener(), { key: "Enter" });
    await waitFor(() => {
      expect(opener()).toHaveAttribute("aria-expanded", "true");
    });
    expect(first.isConnected).toBe(true);
    goTo(1200);
    tap(press(first, 0, 0));
    expect(onPick).not.toHaveBeenCalled();
    goTo(1100 + OPEN_GUARD_MS + 50);
    tap(press(first, 0, 0));
    expect(onPick).toHaveBeenCalledTimes(1);
  });
});
