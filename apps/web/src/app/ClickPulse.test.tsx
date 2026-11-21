import { fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { must } from "@/test/must";
import { ClickPulse } from "./ClickPulse";

const layer = () => must(document.body.querySelector(".click-pulse-layer"));
const rings = () => [...layer().querySelectorAll<HTMLElement>(".click-pulse")];
const press = (init: PointerEventInit = {}) =>
  fireEvent.pointerDown(document.body, {
    isPrimary: true,
    button: 0,
    clientX: 120,
    clientY: 80,
    ...init,
  });

function reduceMotion(reduce: boolean) {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: reduce && query.includes("reduce"),
    media: query,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }));
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("the click ring", () => {
  it("draws one ring where the pointer pressed, on a layer no one can hit or hear", () => {
    reduceMotion(false);
    render(<ClickPulse />);
    expect(layer()).toHaveAttribute("aria-hidden", "true");
    // In the body, not in the app's root: menus and dialogs live there too.
    expect(layer().parentElement).toBe(document.body);
    press();
    const [ring] = rings();
    expect(rings()).toHaveLength(1);
    expect(must(ring).style.left).toBe("120px");
    expect(must(ring).style.top).toBe("80px");
  });

  it("answers the main button and the first finger only", () => {
    reduceMotion(false);
    render(<ClickPulse />);
    press({ button: 2 });
    press({ isPrimary: false });
    expect(rings()).toHaveLength(0);
    press({ pointerType: "touch" });
    expect(rings()).toHaveLength(1);
  });

  it("draws nothing for a person who asked for less motion", () => {
    reduceMotion(true);
    render(<ClickPulse />);
    press();
    expect(rings()).toHaveLength(0);
  });

  it("removes a ring when its animation ends, and after a while if it never does", () => {
    reduceMotion(false);
    vi.useFakeTimers();
    render(<ClickPulse />);
    press();
    must(rings()[0]).dispatchEvent(new Event("animationend"));
    expect(rings()).toHaveLength(0);
    press();
    expect(rings()).toHaveLength(1);
    vi.advanceTimersByTime(1000);
    expect(rings()).toHaveLength(0);
  });

  it("never keeps more than six rings, however fast the presses come", () => {
    reduceMotion(false);
    render(<ClickPulse />);
    for (let index = 0; index < 20; index += 1) press({ clientX: index });
    expect(rings()).toHaveLength(6);
    // The newest are kept.
    expect(must(rings().at(-1)).style.left).toBe("19px");
  });

  it("takes its layer and its listener away when it leaves", () => {
    reduceMotion(false);
    const { unmount } = render(<ClickPulse />);
    press();
    unmount();
    expect(document.body.querySelector(".click-pulse-layer")).toBeNull();
    press();
    expect(document.body.querySelector(".click-pulse")).toBeNull();
  });
});
