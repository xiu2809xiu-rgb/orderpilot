import { act, fireEvent, render } from "@testing-library/react";
import type { PersonAvailability } from "@orderpilot/shared";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { must } from "@/test/must";
import { CaptionWords } from "./CaptionWords";
import { pickerMotion } from "./pickerMotion";

const words: Record<PersonAvailability, string> = {
  AVAILABLE: "Available",
  FOCUSING: "Focusing",
  DO_NOT_DISTURB: "Do not disturb",
};

function motion(reduce: boolean) {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: reduce && query.includes("reduce"),
    media: query,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }));
}

beforeEach(() => {
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

describe("the words in the caption", () => {
  it("draws one word, not leaving, when it first appears", () => {
    const { container } = render(caption("AVAILABLE"));
    expect(texts(container)).toEqual([{ text: "Available", leaving: false }]);
  });

  it("keeps the old word, marked as leaving, beside the new one after a move", () => {
    const { container, rerender } = render(caption("AVAILABLE"));
    rerender(caption("FOCUSING"));
    expect(texts(container)).toEqual([
      { text: "Available", leaving: true },
      { text: "Focusing", leaving: false },
    ]);
  });

  it("takes the old word away when its fade ends", () => {
    const { container, rerender } = render(caption("AVAILABLE"));
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
    vi.useFakeTimers();
    const { container, rerender } = render(caption("AVAILABLE"));
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
    rerender(caption("FOCUSING"));
    rerender(caption("DO_NOT_DISTURB"));
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
});
