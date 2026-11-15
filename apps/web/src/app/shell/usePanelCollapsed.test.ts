import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { usePanelCollapsed } from "./usePanelCollapsed";

function viewport(narrow: boolean) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({
      matches: narrow,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
  window.localStorage.clear();
});

describe("usePanelCollapsed", () => {
  it("starts as the rail below 1024 px until the person chooses", () => {
    viewport(true);
    const { result } = renderHook(() => usePanelCollapsed());
    expect(result.current[0]).toBe(true);
  });

  it("starts open at 1024 px and wider", () => {
    viewport(false);
    const { result } = renderHook(() => usePanelCollapsed());
    expect(result.current[0]).toBe(false);
  });

  it("keeps the person's choice over the width, and remembers it", () => {
    viewport(true);
    const { result, unmount } = renderHook(() => usePanelCollapsed());
    act(() => {
      result.current[1]();
    });
    expect(result.current[0]).toBe(false);
    unmount();
    const again = renderHook(() => usePanelCollapsed());
    expect(again.result.current[0]).toBe(false);
  });
});
