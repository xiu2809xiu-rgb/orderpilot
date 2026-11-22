import { screen, within } from "@testing-library/react";
import { beforeAll, describe, expect, it } from "vitest";
import { SettingsPage } from "../SettingsPage";
import { loadSettingsWords, renderSettings } from "./settingsTestKit";

beforeAll(loadSettingsWords);

const nav = () => screen.getByRole("navigation", { name: "Settings sections" });
const links = () => within(nav()).getAllByRole("link");
const current = () =>
  links()
    .filter((link) => link.getAttribute("aria-current") === "page")
    .map((link) => link.textContent);

describe("the section list", () => {
  it("marks the section the address names as the current page, and no other", async () => {
    renderSettings(<SettingsPage />, { route: "/settings?section=appearance" });
    expect(
      await screen.findByRole("heading", { level: 2, name: "Theme" }),
    ).toBeInTheDocument();
    expect(current()).toEqual(["Appearance"]);
  });

  it("falls back to Account when the section is missing or unknown", async () => {
    const first = renderSettings(<SettingsPage />, {
      route: "/settings?section=nowhere",
    });
    expect(
      await screen.findByRole("heading", { level: 2, name: "Profile" }),
    ).toBeInTheDocument();
    expect(current()).toEqual(["Account"]);
    first.unmount();
    renderSettings(<SettingsPage />);
    expect(
      await screen.findByRole("heading", { level: 2, name: "Profile" }),
    ).toBeInTheDocument();
    expect(current()).toEqual(["Account"]);
  });

  it("lists Controls only for a role that can open one of its pages, and System health only for the system admin", async () => {
    const names = async (role: "FINANCE" | "AUDITOR" | "SYSTEM_ADMIN") => {
      const view = renderSettings(<SettingsPage />, { role });
      await screen.findByRole("navigation", { name: "Settings sections" });
      const found = links().map((link) => link.textContent);
      view.unmount();
      return found;
    };
    expect(await names("FINANCE")).not.toContain("Controls");
    const auditor = await names("AUDITOR");
    expect(auditor).toContain("Controls");
    expect(auditor).not.toContain("System health");
    const admin = await names("SYSTEM_ADMIN");
    expect(admin).toContain("Controls");
    expect(admin).toContain("System health");
  });

  it("says a role may not open a section it follows a stale link to, and keeps the list", async () => {
    renderSettings(<SettingsPage />, {
      role: "FINANCE",
      route: "/settings?section=health",
    });
    expect(
      await screen.findByRole("heading", {
        name: "You do not have access to this",
      }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { level: 2, name: "System health" }),
    ).not.toBeInTheDocument();
    // The list stays, and none of it is marked as the page being shown.
    expect(links().length).toBe(5);
    expect(current()).toEqual([]);
  });

  it("links each section by its address, so Back and a shared link work", async () => {
    renderSettings(<SettingsPage />, { role: "SYSTEM_ADMIN" });
    await screen.findByRole("navigation", { name: "Settings sections" });
    expect(
      within(nav()).getByRole("link", { name: "Keyboard shortcuts" }),
    ).toHaveAttribute("href", "/settings?section=shortcuts");
  });
});
