import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import "@/i18n";
import { ApiError } from "@/lib/api/errors";
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
  it("is three sections for a role that does not manage settings", async () => {
    renderApp("/settings", { session: sessionFor("FINANCE") });
    await screen.findByRole("heading", { name: "Settings" });
    for (const name of ["Appearance", "Your account"]) {
      expect(await screen.findByRole("heading", { name })).toBeInTheDocument();
    }
    // The analytics card is area 4's and titles itself without a heading.
    expect(await screen.findByText("Analytics")).toBeInTheDocument();
    // Service names mean nothing without their status, which only an admin may run.
    expect(
      screen.queryByRole("heading", { name: "Service checks" }),
    ).not.toBeInTheDocument();
    // English is the only language, so there is no card that offers one.
    expect(
      screen.queryByRole("heading", { name: "Language" }),
    ).not.toBeInTheDocument();
  });

  it("adds the service checks for a role that manages settings", async () => {
    renderApp("/settings", { session: sessionFor("SYSTEM_ADMIN") });
    expect(
      await screen.findByRole("heading", { name: "Service checks" }),
    ).toBeInTheDocument();
  });

  it("shows who is signed in and the role's permissions in words, with the code on hover", async () => {
    const session = sessionFor("FINANCE");
    renderApp("/settings", { session });
    const account = (
      await screen.findByRole("heading", { name: "Your account" })
    ).closest("section");
    expect(account).not.toBeNull();
    if (!account) return;
    expect(within(account).getByText(session.user.email)).toBeInTheDocument();
    const code = session.permissions.find((p) => p === "orders.read") ?? "";
    expect(code).not.toBe("");
    const chip = await within(account).findByText("Read orders");
    expect(chip).toHaveAttribute("title", code);
    expect(within(account).queryByText(code)).not.toBeInTheDocument();
  });

  it("moves the theme with the arrow keys, as a radio group does", async () => {
    const user = userEvent.setup();
    renderApp("/settings", { session: sessionFor("SUPPORT") });
    await screen.findByRole("heading", { name: "Settings" });
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
