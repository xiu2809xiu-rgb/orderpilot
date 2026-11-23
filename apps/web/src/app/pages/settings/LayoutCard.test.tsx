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
import { sessionFor } from "@/test/fixtures";
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
    expect(screen.getByRole("button", { name: "Reset" })).toBeInTheDocument();
  });
});

describe("the Saved table layouts row", () => {
  const mine = `op.table.orders.${sessionFor("SUPPORT").user.id}`;

  it("forgets this person's layouts only, then Undo puts them back", async () => {
    localStorage.setItem(mine, '{"hidden":["a"]}');
    localStorage.setItem("op.table.orders.someone-else", '{"hidden":["b"]}');
    localStorage.setItem("op-theme", "dark");
    renderSettings(<LayoutCard />);
    await userEvent.click(screen.getByRole("button", { name: "Reset" }));
    expect(localStorage.getItem(mine)).toBeNull();
    expect(localStorage.getItem("op.table.orders.someone-else")).toBe(
      '{"hidden":["b"]}',
    );
    expect(localStorage.getItem("op-theme")).toBe("dark");
    const toast = useToastStore.getState().items.at(-1);
    expect(toast?.message).toBe("Saved table layouts reset.");
    expect(toast?.undo).toBeTypeOf("function");
    await act(async () => {
      await toast?.undo?.();
    });
    expect(localStorage.getItem(mine)).toBe('{"hidden":["a"]}');
  });

  it("says so when nothing was saved, and offers no Undo", async () => {
    renderSettings(<LayoutCard />);
    await userEvent.click(screen.getByRole("button", { name: "Reset" }));
    const toast = useToastStore.getState().items.at(-1);
    expect(toast?.message).toBe("There were no saved table layouts.");
    expect(toast?.undo).toBeUndefined();
  });
});
