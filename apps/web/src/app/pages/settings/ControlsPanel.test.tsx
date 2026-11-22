import type { Role } from "@orderpilot/shared";
import { screen, within } from "@testing-library/react";
import { beforeAll, describe, expect, it } from "vitest";
import { ControlsPanel } from "./ControlsPanel";
import { loadSettingsWords, renderSettings } from "./settingsTestKit";

beforeAll(loadSettingsWords);

function rows(role: Role) {
  renderSettings(<ControlsPanel />, { role });
  return within(screen.getByRole("list"))
    .getAllByRole("listitem")
    .map((row) => row.querySelector("p")?.textContent);
}

describe("the controls section", () => {
  it("gives the system admin the pages for people, roles, the audit log and monitoring", () => {
    expect(rows("SYSTEM_ADMIN")).toEqual([
      "People",
      "Roles and access",
      "Audit log",
      "Monitoring",
    ]);
  });

  it("gives the auditor the roles, the audit log and monitoring, but not people", () => {
    expect(rows("AUDITOR")).toEqual([
      "Roles and access",
      "Audit log",
      "Monitoring",
    ]);
  });

  it("gives management monitoring only", () => {
    expect(rows("MANAGEMENT")).toEqual(["Monitoring"]);
  });

  it("opens each page by its address, and names the page in the link", () => {
    renderSettings(<ControlsPanel />, { role: "SYSTEM_ADMIN" });
    const expected: [string, string][] = [
      ["People", "/governance?tab=users"],
      ["Roles and access", "/governance?tab=matrix"],
      ["Audit log", "/audit"],
      ["Monitoring", "/monitoring"],
    ];
    for (const [name, href] of expected) {
      const link = screen.getByRole("link", { name: `Open ${name}` });
      expect(link).toHaveAttribute("href", href);
      // The visible word is inside the accessible name (WCAG 2.5.3).
      expect(link.textContent).toBe("Open");
    }
  });
});
