import { screen, within } from "@testing-library/react";
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { AppearancePanel } from "./AppearancePanel";
import { PANEL_GROUPS } from "./panelLayout";
import { loadSettingsWords, renderSettings } from "./settingsTestKit";

beforeAll(loadSettingsWords);

/** The shell draws the side menu as a panel from 768 px, and as a sheet below. */
function setViewport(wide: boolean) {
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
  setViewport(true);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const headings = () =>
  screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent);

describe("the Appearance panel", () => {
  it("ends with Reset: the groups run Theme, Layout, Region, Reset", () => {
    renderSettings(<AppearancePanel />);
    expect(headings()).toEqual(["Theme", "Layout", "Region", "Reset"]);
  });

  it("holds the reset button in the last group only, and the Layout card no longer holds it", () => {
    renderSettings(<AppearancePanel />);
    const last = screen.getAllByRole("region").at(-1);
    expect(last).toBeDefined();
    if (!last) return;
    expect(
      within(last).getByRole("button", { name: "Reset" }),
    ).toBeInTheDocument();
    const layout = screen.getByRole("region", { name: "Layout" });
    expect(within(layout).queryByRole("button")).toBeNull();
    expect(screen.getAllByRole("button", { name: "Reset" })).toHaveLength(1);
  });

  it("draws no empty Layout card where the side menu is a sheet, and still ends with Reset", () => {
    setViewport(false);
    renderSettings(<AppearancePanel />);
    expect(headings()).toEqual(["Theme", "Region", "Reset"]);
  });

  it("stacks its groups with the shared group gap", () => {
    const { container } = renderSettings(<AppearancePanel />);
    expect(container.firstElementChild).toHaveClass(...PANEL_GROUPS.split(" "));
  });
});
