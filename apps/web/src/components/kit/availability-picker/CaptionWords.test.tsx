import { act, fireEvent, render } from "@testing-library/react";
import type { PersonAvailability } from "@orderpilot/shared";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { must } from "@/test/must";
import { CaptionWords } from "./CaptionWords";
import { arrivingOpacity, pickerMotion } from "./pickerMotion";

const words: Record<PersonAvailability, string> = {
  AVAILABLE: "Available",
  FOCUSING: "Focusing",
  DO_NOT_DISTURB: "Do not disturb",
};

// The words' fade is worked out from the time since they were drawn, so the
// clock is held and each test says how long it waits.
let now = 5_000;
function later(ms: number) {
  now += ms;
}

const listeners = new Set<() => void>();
let reduced = false;
function motion(reduce: boolean) {
  reduced = reduce;
  listeners.clear();
  vi.stubGlobal("matchMedia", (query: string) => ({
    get matches() {
      return reduced && query.includes("reduce");
    },
    media: query,
    addEventListener: (_type: string, listener: () => void) => {
      listeners.add(listener);
    },
    removeEventListener: (_type: string, listener: () => void) => {
      listeners.delete(listener);
    },
  }));
}
/** The person switches reduced motion on or off while the page is open. */
function switchMotion(reduce: boolean) {
  reduced = reduce;
  act(() => {
    for (const listener of listeners) listener();
  });
}

beforeEach(() => {
  now = 5_000;
  vi.spyOn(performance, "now").mockImplementation(() => now);
  // A browser can be observed; jsdom cannot, and the kit then holds still.
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      observe() {
        return undefined;
      }
      unobserve() {
        return undefined;
      }
      disconnect() {
        return undefined;
      }
    },
  );
  motion(false);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function caption(stop: PersonAvailability) {
  return <CaptionWords stop={stop} text={words[stop]} />;
}

function texts(container: HTMLElement) {
  return [...container.querySelectorAll<HTMLElement>(".ap-chip-text")].map(
    (node) => ({
      text: node.textContent,
      leaving: node.hasAttribute("data-leaving"),
    }),
  );
}

/** Where the leaving word's fade starts, as the sheet reads it. */
function startOfFade(container: HTMLElement) {
  const old = must(container.querySelector<HTMLElement>("[data-leaving]"));
  return Number(old.style.getPropertyValue("--ap-out-from"));
}

describe("the words in the caption", () => {
  it("draws one word, not leaving, when it first appears", () => {
    const { container } = render(caption("AVAILABLE"));
    expect(texts(container)).toEqual([{ text: "Available", leaving: false }]);
  });

  it("keeps the old word, marked as leaving, beside the new one after a move", () => {
    const { container, rerender } = render(caption("AVAILABLE"));
    later(500);
    rerender(caption("FOCUSING"));
    expect(texts(container)).toEqual([
      { text: "Available", leaving: true },
      { text: "Focusing", leaving: false },
    ]);
  });

  it("takes the old word away when its fade ends", () => {
    const { container, rerender } = render(caption("AVAILABLE"));
    later(500);
    rerender(caption("FOCUSING"));
    const old = must(container.querySelector<HTMLElement>("[data-leaving]"));
    // jsdom has no AnimationEvent: React reads the two names, so both are sent.
    act(() => {
      for (const name of ["animationend", "webkitAnimationEnd"]) {
        fireEvent(
          old,
          Object.assign(new Event(name, { bubbles: true }), {
            animationName: "ap-text-out",
          }),
        );
      }
    });
    expect(texts(container)).toEqual([{ text: "Focusing", leaving: false }]);
  });

  it("ignores the end of another animation", () => {
    const { container, rerender } = render(caption("AVAILABLE"));
    later(500);
    rerender(caption("FOCUSING"));
    const old = must(container.querySelector<HTMLElement>("[data-leaving]"));
    act(() => {
      for (const name of ["animationend", "webkitAnimationEnd"]) {
        fireEvent(
          old,
          Object.assign(new Event(name, { bubbles: true }), {
            animationName: "ap-text-in",
          }),
        );
      }
    });
    expect(texts(container)).toHaveLength(2);
  });

  it("takes the old word away by a timer when the tab never fires the event", () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const { container, rerender } = render(caption("AVAILABLE"));
    later(500);
    rerender(caption("FOCUSING"));
    act(() => {
      vi.advanceTimersByTime(pickerMotion.chipLeaveMs);
    });
    expect(texts(container)).toHaveLength(2);
    act(() => {
      vi.advanceTimersByTime(150);
    });
    expect(texts(container)).toEqual([{ text: "Focusing", leaving: false }]);
  });

  it("leaves one leaving word, not three, after three quick moves", () => {
    const { container, rerender } = render(caption("AVAILABLE"));
    later(200);
    rerender(caption("FOCUSING"));
    later(200);
    rerender(caption("DO_NOT_DISTURB"));
    later(200);
    rerender(caption("AVAILABLE"));
    expect(texts(container)).toEqual([
      { text: "Do not disturb", leaving: true },
      { text: "Available", leaving: false },
    ]);
  });

  it("draws no leaving word when the words are told again with the same choice", () => {
    const { container, rerender } = render(caption("FOCUSING"));
    rerender(<CaptionWords stop="FOCUSING" text="Focusing for now" />);
    expect(texts(container)).toEqual([
      { text: "Focusing for now", leaving: false },
    ]);
  });

  it("changes the word at once under reduced motion, with no leaving word", () => {
    motion(true);
    const { container, rerender } = render(caption("AVAILABLE"));
    rerender(caption("FOCUSING"));
    expect(texts(container)).toEqual([{ text: "Focusing", leaving: false }]);
  });

  it("changes the word at once where the kit holds still, as jsdom does", () => {
    vi.unstubAllGlobals();
    motion(false);
    const { container, rerender } = render(caption("AVAILABLE"));
    rerender(caption("FOCUSING"));
    expect(texts(container)).toEqual([{ text: "Focusing", leaving: false }]);
  });

  it("starts a word that was still arriving from the opacity it had, not from full", () => {
    const { container, rerender } = render(caption("AVAILABLE"));
    // 100 ms in: the 60 ms wait is over and the fade is part of the way.
    later(100);
    rerender(caption("FOCUSING"));
    const from = startOfFade(container);
    expect(from).toBeGreaterThan(0);
    expect(from).toBeLessThan(1);
    expect(from).toBeCloseTo(arrivingOpacity(100), 3);
  });

  it("draws no leaving word for a word that had not yet become visible", () => {
    const { container, rerender } = render(caption("AVAILABLE"));
    later(pickerMotion.chipTextWaitMs - 10);
    rerender(caption("FOCUSING"));
    expect(texts(container)).toEqual([{ text: "Focusing", leaving: false }]);
  });

  it("starts a word that had finished arriving from full opacity", () => {
    const { container, rerender } = render(caption("AVAILABLE"));
    later(1000);
    rerender(caption("FOCUSING"));
    expect(startOfFade(container)).toBe(1);
  });

  it("leaves a word that arrived by a move from where it had got to, not from full", () => {
    const { container, rerender } = render(caption("AVAILABLE"));
    later(1000);
    rerender(caption("FOCUSING"));
    // Focusing has been in the capsule for 100 ms when the caption moves on.
    later(100);
    rerender(caption("DO_NOT_DISTURB"));
    expect(texts(container)).toEqual([
      { text: "Focusing", leaving: true },
      { text: "Do not disturb", leaving: false },
    ]);
    expect(startOfFade(container)).toBeCloseTo(arrivingOpacity(100), 3);
  });

  it("clears its timer when the pill goes while a word is leaving", () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const { rerender, unmount } = render(caption("AVAILABLE"));
    later(500);
    rerender(caption("FOCUSING"));
    expect(vi.getTimerCount()).toBe(1);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("removes a leaving word at once when reduced motion is switched on", () => {
    const { container, rerender } = render(caption("AVAILABLE"));
    later(500);
    rerender(caption("FOCUSING"));
    expect(texts(container)).toHaveLength(2);
    switchMotion(true);
    expect(texts(container)).toEqual([{ text: "Focusing", leaving: false }]);
  });
});
