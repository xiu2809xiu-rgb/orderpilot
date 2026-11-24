import { screen, within } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import i18n from "@/i18n";
import { SHORTCUTS } from "@/app/shell/shortcutRegistry";
import { SparkPanelProvider } from "@/app/shell/sparkPanel";
import { loadSettingsWords, renderSettings } from "./settingsTestKit";
import { ShortcutsPanel } from "./ShortcutsPanel";

const demo = vi.hoisted(() => ({ available: true }));
vi.mock("@/app/shell/demoParts", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useDemoParts: () => demo.available,
}));
vi.mock("@/features/directions/spark/orb/orbGpu", () => ({
  prepareOrbGpu: () => Promise.resolve(null),
}));

beforeAll(loadSettingsWords);

afterEach(() => {
  demo.available = true;
});

function mount() {
  return renderSettings(
    <SparkPanelProvider>
      <ShortcutsPanel />
    </SparkPanelProvider>,
  );
}

describe("the keyboard shortcuts section", () => {
  it("lists every shortcut of the registry in two groups, by the registry's own words", () => {
    mount();
    const everywhere = screen
      .getByRole("heading", { name: "Everywhere" })
      .closest("section");
    const lists = screen
      .getByRole("heading", { name: "On lists and forms" })
      .closest("section");
    expect(everywhere).not.toBeNull();
    expect(lists).not.toBeNull();
    if (!everywhere || !lists) return;
    for (const entry of SHORTCUTS) {
      const group = entry.group === "everywhere" ? everywhere : lists;
      expect(
        within(group).getByText(i18n.t(`common:shortcuts.${entry.id}`)),
      ).toBeInTheDocument();
    }
  });

  it("draws Ctrl and the key as two keys, and Esc as one", () => {
    mount();
    const row = screen
      .getByText("Search or jump to a page, order or record")
      .closest("li");
    expect(row).not.toBeNull();
    if (!row) return;
    expect(
      Array.from(row.querySelectorAll("kbd")).map((key) => key.textContent),
    ).toEqual(["Ctrl", "K"]);
    const close = screen
      .getByText("Close a panel, menu or dialog")
      .closest("li");
    expect(
      Array.from(close?.querySelectorAll("kbd") ?? []).map(
        (key) => key.textContent,
      ),
    ).toEqual(["Esc"]);
  });

  it("explains the two keys that need a page to work with, and that they cannot be changed", () => {
    mount();
    expect(
      screen.getByText("Works on pages that have a search box."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Works on pages that have a New button."),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Letter keys do nothing while you are typing in a field. Shortcuts cannot be changed.",
      ),
    ).toBeInTheDocument();
  });

  it("leaves Spark's key out where Spark is not offered", () => {
    demo.available = false;
    mount();
    expect(screen.queryByText("Open or close Spark")).toBeNull();
    expect(
      screen.getByText("Search or jump to a page, order or record"),
    ).toBeInTheDocument();
  });
});
