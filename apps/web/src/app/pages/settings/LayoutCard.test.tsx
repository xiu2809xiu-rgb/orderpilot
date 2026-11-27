import { act, renderHook, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { useToastStore } from "@/components/common/toast";
import { usePanelStore } from "@/app/shell/panelCollapsedStore";
import { usePanelCollapsed } from "@/app/shell/usePanelCollapsed";
import { LayoutCard } from "./LayoutCard";
import { loadSettingsWords, renderSettings } from "./settingsTestKit";

const KEY = "op-dx-panel-collapsed";

beforeAll(loadSettingsWords);

/** A window wide enough for the side panel, as the shell draws it from 768 px. */
function wideWindow(wide = true) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string) => ({
      matches: query.includes("min-width") ? wide : false,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );
}

beforeEach(() => {
  wideWindow();
});

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
  usePanelStore.setState({ preference: "auto" });
  useToastStore.setState({ items: [] });
});

describe("the Side menu row", () => {
  it("writes Full as 0 and Compact as 1, and Automatic takes the key away", async () => {
    renderSettings(<LayoutCard />);
    await userEvent.click(screen.getByRole("radio", { name: "Compact" }));
    expect(localStorage.getItem(KEY)).toBe("1");
    await userEvent.click(screen.getByRole("radio", { name: "Full" }));
    expect(localStorage.getItem(KEY)).toBe("0");
    await userEvent.click(screen.getByRole("radio", { name: "Automatic" }));
    expect(localStorage.getItem(KEY)).toBeNull();
    expect(screen.getByRole("radio", { name: "Automatic" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
  });

  it("stays in step with the top bar's toggle, both ways", async () => {
    const bar = renderHook(() => usePanelCollapsed());
    renderSettings(<LayoutCard />);
    await userEvent.click(screen.getByRole("radio", { name: "Compact" }));
    expect(bar.result.current[0]).toBe(true);
    act(() => {
      bar.result.current[1]();
    });
    expect(screen.getByRole("radio", { name: "Full" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
  });

  it("is left out where the side menu is a sheet, because the choice would do nothing", () => {
    wideWindow(false);
    renderSettings(<LayoutCard />);
    expect(screen.queryByRole("radiogroup", { name: "Side menu" })).toBeNull();
    // The reset moved to the last group (ResetCard), so the card holds nothing here.
    expect(screen.queryByRole("region", { name: "Layout" })).toBeNull();
  });

  it("holds the side menu choice only: the reset of the table layouts is in the last group", () => {
    renderSettings(<LayoutCard />);
    expect(screen.getByRole("radiogroup", { name: "Side menu" })).toBeVisible();
    expect(screen.queryByRole("button", { name: "Reset" })).toBeNull();
  });
});
