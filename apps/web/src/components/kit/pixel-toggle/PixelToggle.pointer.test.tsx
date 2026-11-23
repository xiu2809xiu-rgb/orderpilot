import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PixelToggle } from "./PixelToggle";

/** jsdom has no PointerEvent: a MouseEvent that carries the three fields the engine reads. */
class TestPointerEvent extends MouseEvent {
  readonly pointerId: number;
  readonly isPrimary: boolean;
  readonly pointerType: string;
  constructor(type: string, init: PointerEventInit = {}) {
    super(type, init);
    this.pointerId = init.pointerId ?? 1;
    this.isPrimary = init.isPrimary ?? true;
    this.pointerType = init.pointerType ?? "mouse";
  }
}

/** The switch as the 36 px top bar draws it: 68.8 by 36, one track unit is about 0.13 px. */
const WIDTH = 68.8125;
const HEIGHT = 36;
// The knob travels 248 of the track's 520 units: about 32.8 px at this size.

let now = 0;

beforeEach(() => {
  now = 1000;
  vi.stubGlobal("PointerEvent", TestPointerEvent);
  vi.spyOn(performance, "now").mockImplementation(() => now);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function Harness({ onChange }: { onChange: (checked: boolean) => void }) {
  const [checked, setChecked] = useState(false);
  return (
    <PixelToggle
      checked={checked}
      label="Light theme"
      onCheckedChange={(next) => {
        onChange(next);
        setChecked(next);
      }}
    />
  );
}

async function mountOff() {
  const onChange = vi.fn();
  render(<Harness onChange={onChange} />);
  const button = screen.getByRole("switch");
  // Before the engine arrives, so that its first measure sees a size.
  button.getBoundingClientRect = () => new DOMRect(0, 0, WIDTH, HEIGHT);
  button.setPointerCapture = vi.fn();
  button.hasPointerCapture = vi.fn(() => true);
  button.releasePointerCapture = vi.fn();
  await waitFor(() => {
    expect(button.querySelectorAll("canvas")).toHaveLength(2);
  });
  return { button, onChange };
}

function pointer(
  button: HTMLElement,
  type: "pointerdown" | "pointermove" | "pointerup",
  x: number,
  pointerType: "mouse" | "touch",
) {
  fireEvent(
    button,
    new TestPointerEvent(type, {
      bubbles: true,
      clientX: x,
      clientY: HEIGHT / 2,
      button: 0,
      pointerType,
    }),
  );
}

/** What a browser sends for a tap or a click: down, a move, up, then the click. */
function tapWithWobble(
  button: HTMLElement,
  wobble: number,
  pointerType: "mouse" | "touch",
) {
  const start = 12;
  pointer(button, "pointerdown", start, pointerType);
  now += 20;
  pointer(button, "pointermove", start + wobble, pointerType);
  now += 20;
  pointer(button, "pointerup", start + wobble, pointerType);
  fireEvent.click(button, { detail: 1 });
}

describe("a click or a tap with a little pointer movement", () => {
  it("switches exactly once for a mouse click that wobbles by 1 px", async () => {
    const { button, onChange } = await mountOff();
    tapWithWobble(button, 1, "mouse");
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(true);
    expect(button).toHaveAttribute("aria-checked", "true");
  });

  it("switches exactly once for a touch tap that wobbles by 3 px", async () => {
    const { button, onChange } = await mountOff();
    tapWithWobble(button, 3, "touch");
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(true);
    expect(button).toHaveAttribute("aria-checked", "true");
  });
});

describe("a drag", () => {
  it("switches once, and calls onCheckedChange once, for about 30 px from the off end to the on end", async () => {
    const { button, onChange } = await mountOff();
    pointer(button, "pointerdown", 12, "mouse");
    now += 60;
    pointer(button, "pointermove", 12 + 15, "mouse");
    now += 60;
    pointer(button, "pointermove", 12 + 30, "mouse");
    now += 60;
    pointer(button, "pointerup", 12 + 30, "mouse");
    // The click a browser sends after a drag is not a second switch.
    fireEvent.click(button, { detail: 1 });
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(true);
    expect(button).toHaveAttribute("aria-checked", "true");
  });

  it("leaves it as it was when a 10 px drag ends before half way", async () => {
    const { button, onChange } = await mountOff();
    pointer(button, "pointerdown", 12, "mouse");
    now += 200;
    pointer(button, "pointermove", 12 + 10, "mouse");
    now += 200;
    pointer(button, "pointerup", 12 + 10, "mouse");
    fireEvent.click(button, { detail: 1 });
    expect(onChange).not.toHaveBeenCalled();
    expect(button).toHaveAttribute("aria-checked", "false");
  });
});
