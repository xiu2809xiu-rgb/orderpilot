import { authRoutes, ROLES } from "@orderpilot/shared";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axe from "axe-core";
import { Package } from "lucide-react";
import { lazy, useState } from "react";
import { createMemoryRouter } from "react-router";
import { describe, expect, it, vi } from "vitest";
import { defineFeature } from "@/features/define";
import { ApiError } from "@/lib/api/errors";
import { apiClient } from "@/lib/api/instance";
import { mockApi, sessionFor } from "@/test/fixtures";
import { renderApp, resetApp } from "@/test/render";
import { App } from "./App";
import { buildRoutes, createTestRouter } from "./router";

const paths = (fetchMock: ReturnType<typeof vi.fn>) =>
  (fetchMock.mock.calls as unknown as [string][]).map(([url]) => url);

describe("signed out", () => {
  it("sends a visitor to the login page and asks the API nothing about a session", async () => {
    const { fetch, router } = renderApp("/orders");
    expect(
      await screen.findByRole("heading", { name: "Sign in to OrderPilot" }),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/login");
    expect(router.state.location.search).toContain("next=%2Forders");
    // Options only: no /auth/me, and above all no /auth/refresh.
    await waitFor(() => {
      expect(paths(fetch)).toContain("/api/v1/auth/options");
    });
    expect(paths(fetch).filter((p) => /refresh|\/me$/.test(p))).toEqual([]);
  });

  it("offers the demo roles only when the API says demo mode is on", async () => {
    renderApp("/login", { demoMode: true });
    expect(
      await screen.findByRole("list", { name: "Demo roles" }),
    ).toBeInTheDocument();
  });

  it("hides the demo sign-in when demo mode is off", async () => {
    const { fetch } = renderApp("/login", { demoMode: false });
    await screen.findByRole("heading", { name: "Sign in to OrderPilot" });
    await waitFor(() => {
      expect(paths(fetch)).toContain("/api/v1/auth/options");
    });
    expect(
      screen.queryByRole("list", { name: "Demo roles" }),
    ).not.toBeInTheDocument();
  });

  it("signs in as a demo role and lands on that role's home page", async () => {
    const user = userEvent.setup();
    const { router } = renderApp("/login");
    const roles = await screen.findByRole("list", { name: "Demo roles" });
    await user.click(within(roles).getByRole("button", { name: /Warehouse/ }));
    expect(
      await screen.findByRole("heading", { name: "Welcome, Hafiz Rahman" }),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/");
  });

  it("returns to the page the visitor wanted after signing in", async () => {
    const user = userEvent.setup();
    const { router } = renderApp("/orders");
    const roles = await screen.findByRole("list", { name: "Demo roles" });
    await user.click(within(roles).getByRole("button", { name: /Support/ }));
    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/orders");
    });
  });

  it("shows the server's reason and trace id for a wrong password", async () => {
    const user = userEvent.setup();
    renderApp("/login");
    await user.type(await screen.findByLabelText("Email"), "mei@example.test");
    await user.type(screen.getByLabelText("Password"), "wrong");
    await user.click(screen.getByRole("button", { name: "Sign in" }));
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("The email or password is not right.");
    expect(alert).toHaveTextContent("trace-bad-login");
  });

  it("checks the form before sending anything", async () => {
    const user = userEvent.setup();
    const { fetch } = renderApp("/login");
    await user.click(await screen.findByRole("button", { name: "Sign in" }));
    expect(await screen.findAllByText("This field is required.")).toHaveLength(
      2,
    );
    expect(paths(fetch).some((p) => p.endsWith("/auth/login"))).toBe(false);
  });
});

describe("signed in", () => {
  it("opens straight onto the role home after a reload with a session", async () => {
    renderApp("/", { session: sessionFor("FINANCE") });
    expect(
      await screen.findByRole("heading", { name: "Welcome, Grace Ong" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Finance home")).toBeInTheDocument();
  });

  it("falls back to the login page when a stale session cookie cannot be restored", async () => {
    const api = mockApi({ session: null });
    vi.stubGlobal("fetch", api.fetch);
    resetApp();
    document.cookie = "op_csrf=stale";
    const router = createTestRouter(["/"]);
    render(<App router={router} />);
    expect(
      await screen.findByRole("heading", { name: "Sign in to OrderPilot" }),
    ).toBeInTheDocument();
    // The cookie says a session once existed, so one refresh was tried.
    expect(
      paths(api.fetch).filter((p) => p.endsWith("/auth/refresh")),
    ).toHaveLength(1);
  });

  it("shows tiles with a dash and Planned, never an invented count", async () => {
    renderApp("/", { session: sessionFor("WAREHOUSE") });
    const tile = await screen.findByRole("link", { name: /Ready to ship/ });
    expect(tile).toHaveAttribute("href", "/orders");
    expect(tile).toHaveTextContent("Planned");
    expect(tile).toHaveTextContent("No count yet");
    expect(tile.textContent).not.toMatch(/\d/);
  });

  it("gives each role its own menu inside a navigation landmark", async () => {
    renderApp("/", { session: sessionFor("WAREHOUSE") });
    await screen.findByRole("heading", { name: /Welcome/ });
    const nav = screen.getByRole("navigation", { name: "Main navigation" });
    expect(
      within(nav).getByRole("link", { name: "Orders" }),
    ).toBeInTheDocument();
    expect(
      within(nav).queryByRole("link", { name: "Governance" }),
    ).not.toBeInTheDocument();
    expect(
      within(nav).queryByRole("link", { name: "Audit log" }),
    ).not.toBeInTheDocument();
  });

  it("stops a typed URL for an area the role may not open", async () => {
    renderApp("/governance", { session: sessionFor("WAREHOUSE") });
    expect(
      await screen.findByRole("heading", { name: "You do not have access" }),
    ).toBeInTheDocument();
  });

  it("shows a planned page for an area", async () => {
    renderApp("/orders", { session: sessionFor("SUPPORT") });
    expect(
      await screen.findByRole("heading", { name: "Orders" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Planned")).toBeInTheDocument();
    expect(screen.getByText("What arrives here")).toBeInTheDocument();
    const crumbs = screen.getByRole("navigation", { name: "Breadcrumb" });
    expect(
      within(crumbs).getByRole("link", { name: "Home" }),
    ).toBeInTheDocument();
    expect(within(crumbs).getByText("Orders")).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("shows a 404 page for an address that does not exist", async () => {
    renderApp("/nowhere", { session: sessionFor("SUPPORT") });
    expect(
      await screen.findByRole("heading", { name: "Page not found" }),
    ).toBeInTheDocument();
  });

  it("puts the skip link first in the tab order", async () => {
    const user = userEvent.setup();
    renderApp("/", { session: sessionFor("SUPPORT") });
    await screen.findByRole("heading", { name: /Welcome/ });
    await user.tab();
    expect(
      screen.getByRole("link", { name: "Skip to main content" }),
    ).toHaveFocus();
  });

  it("switches the theme and remembers it", async () => {
    const user = userEvent.setup();
    renderApp("/settings", { session: sessionFor("SUPPORT") });
    await screen.findByRole("heading", { name: "Settings" });
    await user.click(screen.getByRole("radio", { name: "Dark" }));
    expect(document.documentElement).toHaveClass("dark");
    expect(localStorage.getItem("op-theme")).toBe("dark");
    await user.click(screen.getByRole("radio", { name: "Light" }));
    expect(document.documentElement).not.toHaveClass("dark");
  });

  it("opens the command palette with Control K and jumps to an area", async () => {
    const user = userEvent.setup();
    const { router } = renderApp("/", { session: sessionFor("SUPPORT") });
    await screen.findByRole("heading", { name: /Welcome/ });
    await user.keyboard("{Control>}k{/Control}");
    const box = await screen.findByRole("combobox");
    await user.type(box, "docu");
    await user.click(await screen.findByRole("option", { name: /Documents/ }));
    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/documents");
    });
  });

  it("signs out to the login page", async () => {
    const user = userEvent.setup();
    const { router } = renderApp("/", { session: sessionFor("SUPPORT") });
    await screen.findByRole("heading", { name: /Welcome/ });
    await user.click(screen.getByRole("button", { name: "Account menu" }));
    await user.click(await screen.findByRole("menuitem", { name: "Sign out" }));
    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/login");
    });
  });
});

describe("the demo role switcher", () => {
  it("is there when demo mode is on, and changes the home page", async () => {
    const user = userEvent.setup();
    renderApp("/", { session: sessionFor("SUPPORT"), demoMode: true });
    await screen.findByRole("heading", { name: "Welcome, Mei Tan" });
    await user.click(await screen.findByRole("button", { name: "Demo role" }));
    await user.click(await screen.findByRole("menuitem", { name: /Auditor/ }));
    expect(
      await screen.findByRole("heading", { name: "Welcome, Lucas Wong" }),
    ).toBeInTheDocument();
  });

  it("is not there when demo mode is off", async () => {
    const { fetch } = renderApp("/", {
      session: sessionFor("SUPPORT"),
      demoMode: false,
    });
    await screen.findByRole("heading", { name: /Welcome/ });
    await waitFor(() => {
      expect(paths(fetch)).toContain("/api/v1/auth/options");
    });
    expect(
      screen.queryByRole("button", { name: "Demo role" }),
    ).not.toBeInTheDocument();
  });
});

/** A page with a form, so a test can type into it before the session ends. */
const notes = defineFeature({
  id: "notes",
  namespace: "orders",
  path: "notes",
  group: "operations",
  icon: Package,
  cues: [],
  Page: lazy(() =>
    Promise.resolve({
      default: function NotesPage() {
        const [text, setText] = useState("");
        return (
          <label>
            Draft
            <input
              value={text}
              onChange={(event) => {
                setText(event.target.value);
              }}
            />
          </label>
        );
      },
    }),
  ),
});

describe("a session that ends", () => {
  it("keeps the page and what was typed, and asks for a sign-in over it", async () => {
    const user = userEvent.setup();
    const api = mockApi({ session: sessionFor("SUPPORT") });
    vi.stubGlobal("fetch", api.fetch);
    resetApp();
    document.cookie = "op_csrf=csrf-token-1";
    apiClient.markSessionStarted();
    const router = createMemoryRouter(buildRoutes([notes]), {
      initialEntries: ["/notes"],
    });
    render(<App router={router} />);

    const draft = await screen.findByLabelText("Draft");
    await user.type(draft, "half-written reply");

    // The API forgets the session; the next call fails and the refresh fails.
    api.state.session = null;
    await act(async () => {
      await apiClient.call(authRoutes.me).catch(() => undefined);
    });

    const dialog = await screen.findByRole("dialog", {
      name: "Your session ended",
    });
    expect(screen.getByLabelText("Draft", { selector: "input" })).toHaveValue(
      "half-written reply",
    );

    await user.click(within(dialog).getByRole("button", { name: /Support/ }));
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
    expect(screen.getByLabelText("Draft")).toHaveValue("half-written reply");
    expect(router.state.location.pathname).toBe("/notes");
  });
});

describe("the crash page", () => {
  it("shows the trace id of an API error that broke a page", async () => {
    const broken = defineFeature({
      ...notes,
      id: "broken",
      path: "broken",
      Page: lazy(() =>
        Promise.resolve({
          default: function Broken(): never {
            throw new ApiError("INTERNAL_ERROR", "boom", 500, "trace-crash-42");
          },
        }),
      ),
    });
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const api = mockApi({ session: sessionFor("SUPPORT") });
    vi.stubGlobal("fetch", api.fetch);
    resetApp();
    document.cookie = "op_csrf=csrf-token-1";
    apiClient.markSessionStarted();
    const router = createMemoryRouter(buildRoutes([broken]), {
      initialEntries: ["/broken"],
    });
    render(<App router={router} />);
    expect(
      await screen.findByRole("heading", { name: "Something went wrong" }),
    ).toBeInTheDocument();
    expect(screen.getByText("trace-crash-42")).toBeInTheDocument();
  });
});

describe("accessibility (axe)", () => {
  async function violations(container: HTMLElement) {
    // jsdom has no layout, so colour contrast is covered by tokens.test.ts.
    const results = await axe.run(container, {
      rules: {
        "color-contrast": { enabled: false },
        region: { enabled: false },
      },
    });
    return results.violations.map((v) => `${v.id}: ${v.nodes[0]?.html ?? ""}`);
  }

  it("finds nothing on the login page", async () => {
    const { container } = renderApp("/login");
    await screen.findByRole("list", { name: "Demo roles" });
    expect(await violations(container)).toEqual([]);
  });

  it.each(ROLES)("finds nothing on the %s home page", async (role) => {
    const { container } = renderApp("/", { session: sessionFor(role) });
    await screen.findByRole("heading", { name: /Welcome/ });
    expect(await violations(container)).toEqual([]);
  });

  it("finds nothing on a planned page or the settings page", async () => {
    const first = renderApp("/orders", { session: sessionFor("SUPPORT") });
    await screen.findByRole("heading", { name: "Orders" });
    expect(await violations(first.container)).toEqual([]);
    first.unmount();
    const second = renderApp("/settings", { session: sessionFor("SUPPORT") });
    await screen.findByRole("heading", { name: "Settings" });
    expect(await violations(second.container)).toEqual([]);
  });
});
