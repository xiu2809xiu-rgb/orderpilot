import { readFileSync } from "node:fs";
import path from "node:path";
import { render } from "@testing-library/react";
import { beforeAll, describe, expect, it } from "vitest";
import { SettingList, SettingRow } from "@/components/parts/SettingRow";
import { PANEL_GROUPS } from "./panelLayout";
import { loadSettingsWords, renderSettings } from "./settingsTestKit";
import { ShortcutsPanel } from "./ShortcutsPanel";

beforeAll(loadSettingsWords);

const styles = path.join(import.meta.dirname, "..", "..", "..", "styles");
const tokens = readFileSync(path.join(styles, "tokens.css"), "utf8");
const theme = readFileSync(path.join(styles, "index.css"), "utf8");

/** What a custom property is declared as, the first time it is. */
function declared(source: string, name: string): string {
  const start = source.indexOf(`${name}: `);
  expect(start, `${name} is declared`).toBeGreaterThanOrEqual(0);
  const from = start + name.length + 2;
  return source.slice(from, source.indexOf(";", from));
}

/** A spacing step such as "s4" in rem, followed from the utility's token to the value. */
function stepRem(step: string): number {
  const alias = declared(theme, `--spacing-${step}`); // var(--space-4)
  const space = alias.slice("var(".length, -1);
  return parseFloat(declared(tokens, space));
}

describe("the space between the groups of a Settings panel", () => {
  it("takes its gap from a spacing token above the old step, in one shared class", () => {
    const gap = /^flex flex-col gap-(s\d)$/.exec(PANEL_GROUPS)?.[1];
    expect(gap, "PANEL_GROUPS is a column with a token gap").toBeDefined();
    expect(stepRem("s4")).toBe(2);
    expect(stepRem(gap ?? "")).toBeGreaterThan(stepRem("s4"));
  });

  it("is wider than the space inside a group: a tight list sits closer than the default row", () => {
    // The default row has s3 above and below; a tight list has s2.
    expect(stepRem("s2")).toBeLessThan(stepRem("s3"));
    const tight = render(
      <SettingList tight>
        <SettingRow label="A" value="1" />
      </SettingList>,
    );
    expect(tight.container.querySelector("ul")).toHaveClass("[&>li]:py-s2");
    const plain = render(
      <SettingList>
        <SettingRow label="A" value="1" />
      </SettingList>,
    );
    expect(plain.container.querySelector("ul")).not.toHaveClass("[&>li]:py-s2");
  });

  it("is used by the Shortcuts panel", () => {
    const { container } = renderSettings(<ShortcutsPanel />);
    expect(container.firstElementChild).toHaveClass(...PANEL_GROUPS.split(" "));
  });
});
