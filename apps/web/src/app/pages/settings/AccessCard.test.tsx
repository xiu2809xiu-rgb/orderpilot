import { screen, within } from "@testing-library/react";
import { beforeAll, describe, expect, it } from "vitest";
import { AccessCard } from "./AccessCard";
import { loadSettingsWords, renderSettings } from "./settingsTestKit";

beforeAll(loadSettingsWords);

describe("the What you can do card", () => {
  it("is a list with one row for each kind of work: its name, then what the role may do", () => {
    renderSettings(<AccessCard />, { role: "SUPPORT" });
    const rows = within(screen.getByRole("list")).getAllByRole("listitem");
    expect(rows.length).toBeGreaterThan(2);
    for (const row of rows) {
      // A SettingRow holds the name and then the value, in that order.
      const [name, value] = Array.from(row.querySelectorAll("p"));
      expect(name?.textContent ?? "").not.toBe("");
      expect(value?.textContent ?? "").not.toBe("");
      expect(name).toHaveClass("font-medium");
    }
    const orders = rows.find((row) => row.textContent.startsWith("Orders"));
    expect(orders).toBeDefined();
    expect(orders).toHaveTextContent(/^Orders.*(view|create)/);
  });

  it("puts the name in a grid column of its own, with the value at the right on a wide screen", () => {
    renderSettings(<AccessCard />, { role: "SUPPORT" });
    const row = within(screen.getByRole("list")).getAllByRole("listitem")[0];
    expect(row).toHaveClass("grid", "sm:grid-cols-[minmax(0,1fr)_auto]");
  });

  it("gives every sentence the same width, so that they share a left edge", () => {
    renderSettings(<AccessCard />, { role: "SUPPORT" });
    const rows = within(screen.getByRole("list")).getAllByRole("listitem");
    expect(rows.length).toBeGreaterThan(1);
    for (const row of rows) {
      const sentence = row.querySelector("p.text-muted-foreground");
      expect(sentence).toHaveClass("sm:w-80");
    }
  });
});
