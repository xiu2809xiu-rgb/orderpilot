import { act, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { HomeFigure } from "./HomeFigure";
import { HomeIntroLine } from "./HomeIntroLine";
import { enterProps } from "./entrance";

// The runner has no IntersectionObserver, so the kit shows every finished,
// still state. These tests turn motion on with a stub that sees the figure at
// once, and reduced motion on with a matchMedia that asks for less.

const SENTENCE = "22 tasks are waiting for you. 3 are past their due time.";

class SeenAtOnce {
  constructor(private readonly callback: IntersectionObserverCallback) {}
  observe() {
    this.callback(
      [{ isIntersecting: true } as IntersectionObserverEntry],
      this as unknown as IntersectionObserver,
    );
  }
  unobserve() {
    // Nothing to stop: it saw the figure the moment it was asked.
  }
  disconnect() {
    // Nothing to stop.
  }
}

function withMotion() {
  vi.stubGlobal("IntersectionObserver", SeenAtOnce);
}

function withReducedMotion() {
  vi.stubGlobal("IntersectionObserver", SeenAtOnce);
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: query.includes("reduce"),
    media: query,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }));
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("the line under the greeting", () => {
  it("is the plain sentence where motion cannot be known", () => {
    render(<p>{<HomeIntroLine text={SENTENCE} />}</p>);
    expect(screen.getByText(SENTENCE)).toBeVisible();
  });

  it("shows everything at once under reduced motion", () => {
    withReducedMotion();
    render(
      <p>
        <HomeIntroLine text={SENTENCE} />
      </p>,
    );
    expect(screen.getByText(SENTENCE)).toBeVisible();
    expect(document.querySelector("[aria-hidden='true']")).toBeNull();
  });

  it("counts up to the true figures, and a screen reader hears only the final sentence", async () => {
    withMotion();
    const { container } = render(
      <p>
        <HomeIntroLine text={SENTENCE} />
      </p>,
    );
    expect(screen.getByText(SENTENCE)).toHaveClass("sr-only");
    const counting = container.querySelector("[aria-hidden='true']");
    expect(counting).not.toBeNull();
    await waitFor(
      () => {
        expect(counting?.textContent).toBe(SENTENCE);
      },
      { timeout: 4000 },
    );
  });
});

describe("a figure of Home", () => {
  it("is shown at once when its value changes, never counted again", () => {
    withMotion();
    const { rerender } = render(<HomeFigure value={22} />);
    rerender(<HomeFigure value={21} />);
    expect(screen.getByText("21")).toBeVisible();
  });

  it("is plain text once it has counted", () => {
    vi.useFakeTimers();
    withMotion();
    render(<HomeFigure value={5} />);
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(screen.getByText("5")).not.toHaveClass("numeral");
    vi.useRealTimers();
  });
});

describe("the arrival of a list", () => {
  it("staggers its entries in the first view and not after it", () => {
    expect(enterProps(3, true)).toEqual({
      className: "home-enter",
      style: { "--home-i": 3 },
    });
    expect(enterProps(30, true).style).toEqual({ "--home-i": 9 });
    expect(enterProps(3, false)).toEqual({});
  });
});
