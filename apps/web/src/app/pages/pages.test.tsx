import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import "@/i18n";
import { ApiError } from "@/lib/api/errors";
import { formatLongDay } from "@/lib/format";
import { sessionFor } from "@/test/fixtures";
import { renderApp } from "@/test/render";
import { InShellContext } from "../shell/inShell";
import { CrashView } from "./CrashPage";

describe("not found", () => {
  it("names the address that was opened and offers one way home", async () => {
    renderApp("/no/such/place", { session: sessionFor("SUPPORT") });
    expect(
      await screen.findByRole("heading", { name: "Page not found" }),
    ).toBeInTheDocument();
    const main = screen.getByRole("main");
    expect(within(main).getByText("/no/such/place")).toBeInTheDocument();
    const links = within(main).getAllByRole("link");
    expect(links.map((link) => link.textContent)).toEqual(["Go to home"]);
  });
});

describe("forbidden", () => {
  it("says who is signed in and which role it is, instead of a bare refusal", async () => {
    renderApp("/governance", { session: sessionFor("WAREHOUSE") });
    expect(
      await screen.findByRole("heading", { name: "You do not have access" }),
    ).toBeInTheDocument();
    const main = screen.getByRole("main");
    expect(
      within(main).getByText(/not part of the Warehouse role/),
    ).toBeInTheDocument();
    expect(
      within(main).getByRole("link", { name: "Go to home" }),
    ).toHaveAttribute("href", "/");
  });
});

describe("the crash view", () => {
  const error = new ApiError("INTERNAL_ERROR", "boom", 500, "trace-pages-1");

  it("on its own brings the mark and a main of its own, with the trace id and a way to try again", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    render(<CrashView error={error} />);
    const main = screen.getByRole("main");
    expect(main).toHaveAttribute("id", "main");
    expect(within(main).getByText("OrderPilot")).toBeInTheDocument();
    expect(within(main).getByText("trace-pages-1")).toBeInTheDocument();
    expect(
      within(main).getByRole("button", { name: "Try again" }),
    ).toBeInTheDocument();
    expect(
      within(main).getByRole("link", { name: "Go to home" }),
    ).toHaveAttribute("href", "/");
  });

  it("inside the shell leaves the main and the mark to the shell", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    render(
      <InShellContext.Provider value={true}>
        <CrashView error={error} />
      </InShellContext.Provider>,
    );
    expect(screen.queryByRole("main")).toBeNull();
    expect(screen.queryByText("OrderPilot")).toBeNull();
    expect(screen.getByText("trace-pages-1")).toBeInTheDocument();
  });

  it("makes a reference to quote when the error has none", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    render(<CrashView error={new Error("plain")} />);
    expect(screen.getByText(/^local-[0-9a-f]{8}$/)).toBeInTheDocument();
  });
});

describe("settings", () => {
  const sectionNames = (nav: HTMLElement) =>
    within(nav)
      .getAllByRole("link")
      .map((link) => link.textContent);

  it("lists five sections for a role that does not manage settings, under a title with no date", async () => {
    renderApp("/settings", { session: sessionFor("FINANCE") });
    const title = await screen.findByRole("heading", {
      level: 1,
      name: "Settings",
    });
    expect(title).toBeInTheDocument();
    const nav = await screen.findByRole("navigation", {
      name: "Settings sections",
    });
    expect(sectionNames(nav)).toEqual([
      "Account",
      "Appearance",
      "Keyboard shortcuts",
      "Privacy",
      "AI assistant",
    ]);
    // Neither is for this role: the section is not listed rather than listed and refused.
    expect(
      within(nav).queryByRole("link", { name: "Controls" }),
    ).not.toBeInTheDocument();
    expect(
      within(nav).queryByRole("link", { name: "System health" }),
    ).not.toBeInTheDocument();
    // A settings page is not a report: no date under the title.
    expect(
      screen.queryByText(formatLongDay(new Date())),
    ).not.toBeInTheDocument();
    // English is the only language, so there is no card that offers one.
    expect(
      screen.queryByRole("heading", { name: "Language" }),
    ).not.toBeInTheDocument();
  });

  it("adds Controls and System health for a role that manages settings", async () => {
    renderApp("/settings?section=health", {
      session: sessionFor("SYSTEM_ADMIN"),
    });
    const nav = await screen.findByRole("navigation", {
      name: "Settings sections",
    });
    expect(sectionNames(nav)).toEqual([
      "Account",
      "Appearance",
      "Keyboard shortcuts",
      "Privacy",
      "AI assistant",
      "Controls",
      "System health",
      "Profile pictures",
    ]);
    expect(
      within(nav).getByRole("link", { name: "System health" }),
    ).toHaveAttribute("aria-current", "page");
    expect(
      await screen.findByRole("heading", { level: 2, name: "System health" }),
    ).toBeInTheDocument();
    // The heading alone is drawn while the checks are still loading.
    expect(await screen.findByText("Everything is working")).toBeVisible();
  });

  it("shows who is signed in and what the role can do in words, never as permission codes", async () => {
    const session = sessionFor("FINANCE");
    renderApp("/settings", { session });
    const profile = (
      await screen.findByRole("heading", { name: "Profile" })
    ).closest("section");
    expect(profile).not.toBeNull();
    if (!profile) return;
    expect(within(profile).getByText(session.user.email)).toBeInTheDocument();
    const access = (
      await screen.findByRole("heading", { name: "What you can do" })
    ).closest("section");
    expect(access).not.toBeNull();
    if (!access) return;
    expect(within(access).getByText("Payments")).toBeInTheDocument();
    expect(
      within(access).getByText("Confirm that a customer has paid"),
    ).toBeInTheDocument();
    const code = session.permissions.find((p) => p === "orders.read") ?? "";
    expect(code).not.toBe("");
    expect(document.body).not.toHaveTextContent(code);
    expect(document.querySelector(`[title="${code}"]`)).toBeNull();
  });

  it("moves the theme with the arrow keys, as a radio group does", async () => {
    const user = userEvent.setup();
    renderApp("/settings?section=appearance", {
      session: sessionFor("SUPPORT"),
    });
    await screen.findByRole("heading", { name: "Settings" });
    expect(
      await screen.findByRole("radio", { name: "Match my device" }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("radio", { name: "Light" }));
    await user.keyboard("{ArrowRight}");
    const dark = screen.getByRole("radio", { name: "Dark" });
    expect(dark).toHaveAttribute("aria-checked", "true");
    expect(dark).toHaveFocus();
    expect(document.documentElement).toHaveClass("dark");
    // Only the chosen one is a tab stop: Tab leaves the group.
    expect(screen.getByRole("radio", { name: "Light" })).toHaveAttribute(
      "tabindex",
      "-1",
    );
  });
});
