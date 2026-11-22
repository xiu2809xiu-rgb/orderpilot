import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { usePanelStore } from "./panelCollapsedStore";
import { usePanelCollapsed, usePanelPreference } from "./usePanelCollapsed";

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
  // The choice is held in a store that outlives a test, so put it back.
  usePanelStore.setState({ preference: "auto" });
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

describe("usePanelPreference", () => {
  it("writes full as 0 and compact as 1, and automatic removes the key", () => {
    viewport(false);
    const { result } = renderHook(() => usePanelPreference());
    act(() => {
      result.current[1]("compact");
    });
    expect(window.localStorage.getItem("op-dx-panel-collapsed")).toBe("1");
    act(() => {
      result.current[1]("full");
    });
    expect(window.localStorage.getItem("op-dx-panel-collapsed")).toBe("0");
    act(() => {
      result.current[1]("auto");
    });
    expect(window.localStorage.getItem("op-dx-panel-collapsed")).toBeNull();
    expect(result.current[0]).toBe("auto");
  });

  it("is shared: the bar's toggle and a second reader see the same choice", () => {
    viewport(false);
    const bar = renderHook(() => usePanelCollapsed());
    const settings = renderHook(() => usePanelPreference());
    act(() => {
      settings.result.current[1]("compact");
    });
    expect(bar.result.current[0]).toBe(true);
    act(() => {
      bar.result.current[1]();
    });
    expect(settings.result.current[0]).toBe("full");
  });

  it("goes back to following the window once automatic is chosen again", () => {
    viewport(true);
    const bar = renderHook(() => usePanelCollapsed());
    const settings = renderHook(() => usePanelPreference());
    act(() => {
      settings.result.current[1]("full");
    });
    expect(bar.result.current[0]).toBe(false);
    act(() => {
      settings.result.current[1]("auto");
    });
    expect(bar.result.current[0]).toBe(true);
  });
});
