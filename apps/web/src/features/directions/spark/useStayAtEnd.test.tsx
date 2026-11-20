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

function setup(turn = 1) {
  const geometry: Geometry = {
    scrollHeight: 1000,
    clientHeight: 400,
    scrollTop: 0,
  };
  const region = fakeRegion(geometry);
  const content = document.createElement("ol");
  const view = renderHook(
    ({ id }) => {
      useStayAtEnd({ current: region }, { current: content }, id);
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
  return { geometry, view, grow, scrollTo };
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
});
