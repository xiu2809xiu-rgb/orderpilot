import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useStayAtEnd } from "./useStayAtEnd";

/** jsdom has no layout, so the region's geometry is a plain object the test moves. */
interface Geometry {
  scrollHeight: number;
  clientHeight: number;
  scrollTop: number;
}

function fakeRegion(geometry: Geometry): HTMLElement {
  const region = document.createElement("div");
  Object.defineProperty(region, "scrollHeight", {
    get: () => geometry.scrollHeight,
  });
  Object.defineProperty(region, "clientHeight", {
    get: () => geometry.clientHeight,
  });
  Object.defineProperty(region, "scrollTop", {
    get: () => geometry.scrollTop,
    set: (value: number) => {
      // A browser never scrolls past the end.
      geometry.scrollTop = Math.min(
        value,
        geometry.scrollHeight - geometry.clientHeight,
      );
    },
  });
  return region;
}

let resized: (() => void) | null = null;

class WatchingObserver {
  constructor(callback: () => void) {
    resized = callback;
  }
  observe() {
    // The test calls the callback itself, when it says the content grew.
  }
  unobserve() {
    // Nothing to do.
  }
  disconnect() {
    // Nothing to do.
  }
}

/** The newest answer, with its start at `start` in the region content. */
function fakeAnswer(geometry: Geometry, start: { value: number }) {
  const answer = document.createElement("div");
  answer.getBoundingClientRect = () =>
    ({ top: start.value - geometry.scrollTop }) as DOMRect;
  return answer;
}

function setup(turn = 1, answerStart: number | null = null) {
  const geometry: Geometry = {
    scrollHeight: 1000,
    clientHeight: 400,
    scrollTop: 0,
  };
  const region = fakeRegion(geometry);
  region.getBoundingClientRect = () => ({ top: 0 }) as DOMRect;
  const content = document.createElement("ol");
  const start = { value: answerStart ?? 0 };
  const answer = fakeAnswer(geometry, start);
  const newest = answerStart === null ? undefined : () => answer;
  const view = renderHook(
    ({ id }) => {
      useStayAtEnd({ current: region }, { current: content }, id, newest);
    },
    { initialProps: { id: turn } },
  );
  const grow = (by: number) => {
    geometry.scrollHeight += by;
    act(() => {
      resized?.();
    });
  };
  const scrollTo = (top: number) => {
    geometry.scrollTop = top;
    act(() => {
      region.dispatchEvent(new Event("scroll"));
    });
  };
  return { geometry, view, grow, scrollTo, start };
}

describe("useStayAtEnd", () => {
  beforeEach(() => {
    vi.stubGlobal("ResizeObserver", WatchingObserver);
  });
  afterEach(() => {
    resized = null;
  });

  it("goes to the end when the thread is shown", () => {
    const { geometry } = setup();
    expect(geometry.scrollTop).toBe(600);
  });

  it("stays at the end while the newest answer grows", () => {
    const { geometry, grow } = setup();
    grow(120);
    expect(geometry.scrollTop).toBe(720);
    grow(240);
    expect(geometry.scrollTop).toBe(960);
  });

  it("is not pulled back when the person has scrolled up to read", () => {
    const { geometry, grow, scrollTo } = setup();
    scrollTo(200);
    grow(120);
    expect(geometry.scrollTop).toBe(200);
  });

  it("follows again once the person scrolls back to the end", () => {
    const { geometry, grow, scrollTo } = setup();
    scrollTo(200);
    grow(120);
    scrollTo(geometry.scrollHeight - geometry.clientHeight);
    grow(100);
    expect(geometry.scrollTop).toBe(820);
  });

  it("returns to the end for a new question, even after scrolling up", () => {
    const { geometry, view, grow, scrollTo } = setup(1);
    scrollTo(200);
    geometry.scrollHeight += 150;
    view.rerender({ id: 2 });
    expect(geometry.scrollTop).toBe(750);
    grow(60);
    expect(geometry.scrollTop).toBe(810);
  });

  describe("with the start of the newest answer", () => {
    it("follows a short answer to the end", () => {
      // The answer starts 300 px above the end of a 400 px view: it fits.
      const { geometry, grow } = setup(1, 800);
      grow(100);
      expect(geometry.scrollTop).toBe(700);
    });

    it("holds the start of a tall answer at the top of the view", () => {
      const { geometry, grow } = setup(1, 900);
      grow(200);
      expect(geometry.scrollTop).toBe(800);
      grow(300);
      // The end is now 1500 - 400 = 1100, but the answer starts at 900.
      expect(geometry.scrollTop).toBe(900);
      grow(500);
      expect(geometry.scrollTop).toBe(900);
    });

    it("leaves a scroll by the person alone, up or down", () => {
      const { geometry, grow, scrollTo } = setup(1, 900);
      grow(600);
      expect(geometry.scrollTop).toBe(900);
      scrollTo(1000);
      grow(200);
      expect(geometry.scrollTop).toBe(1000);
      scrollTo(300);
      grow(200);
      expect(geometry.scrollTop).toBe(300);
    });

    it("goes to the end when the person scrolls there, and follows on", () => {
      const { geometry, grow, scrollTo } = setup(1, 900);
      grow(600);
      scrollTo(geometry.scrollHeight - geometry.clientHeight);
      grow(100);
      expect(geometry.scrollTop).toBe(1300);
    });

    it("goes back to the end for a new question", () => {
      const { geometry, view, grow } = setup(1, 900);
      grow(600);
      geometry.scrollHeight += 150;
      view.rerender({ id: 2 });
      expect(geometry.scrollTop).toBe(geometry.scrollHeight - 400);
    });
  });
});
