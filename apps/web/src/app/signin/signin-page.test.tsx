import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { renderApp } from "@/test/render";

describe("the sign-in page with demo mode on", () => {
  it("offers the nine roles, each with its persona, under the password form", async () => {
    renderApp("/login", { demoMode: true });
    const roles = await screen.findByRole("list", { name: "Demo roles" });
    expect(within(roles).getAllByRole("button")).toHaveLength(9);
    expect(
      within(roles).getByRole("button", { name: /Warehouse\s+Hafiz Rahman/ }),
    ).toBeInTheDocument();
    expect(screen.getByText("Synthetic demo data")).toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toBeInTheDocument();
    // The form comes first, so it never moves when the roles arrive below it.
    const form = screen.getByLabelText("Email").compareDocumentPosition(roles);
    expect(form & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("signs in with one click", async () => {
    const user = userEvent.setup();
    const { router } = renderApp("/login", { demoMode: true });
    const roles = await screen.findByRole("list", { name: "Demo roles" });
    await user.click(within(roles).getByRole("button", { name: /Finance/ }));
    await screen.findByRole("heading", {
      name: /^Good (morning|afternoon|evening), /,
    });
    expect(router.state.location.pathname).toBe("/");
  });

  it("keeps what was typed, and the focus, when the roles arrive", async () => {
    const user = userEvent.setup();
    renderApp("/login", { demoMode: true, optionsDelayMs: 300 });
    await user.click(await screen.findByLabelText("Email"));
    await user.keyboard("abc");
    await screen.findByRole("list", { name: "Demo roles" });
    await user.keyboard("def");
    expect(screen.getByLabelText("Email")).toHaveValue("abcdef");
    expect(screen.getByLabelText("Email")).toHaveFocus();
  });

  it("shows a sign-in failure once while the roles are still loading", async () => {
    const user = userEvent.setup();
    renderApp("/login", { demoMode: true, optionsDelayMs: 30_000 });
    await user.type(await screen.findByLabelText("Email"), "a@b.sg");
    await user.type(screen.getByLabelText("Password"), "wrong{Enter}");
    await screen.findByRole("alert");
    // The roles are still on their way: only one place may draw the failure.
    expect(screen.queryByRole("list", { name: "Demo roles" })).toBeNull();
    expect(screen.getAllByRole("alert")).toHaveLength(1);
  });

  it("says the AI and Business Central are stand-ins", async () => {
    renderApp("/login", { demoMode: true });
    expect(await screen.findByText(/stand-ins/)).toBeInTheDocument();
  });
});

describe("the sign-in page with demo mode off", () => {
  it("shows the form and the promise, and no demo roles or badge", async () => {
    const { fetch } = renderApp("/login", { demoMode: false });
    await screen.findByRole("heading", { name: "Sign in to OrderPilot" });
    await waitFor(() => {
      expect(
        (fetch.mock.calls as unknown as [string][]).map(([u]) => u),
      ).toContain("/api/v1/auth/options");
    });
    expect(screen.queryByRole("list", { name: "Demo roles" })).toBeNull();
    expect(screen.queryByText("Synthetic demo data")).toBeNull();
    expect(screen.queryByText(/stand-ins/)).toBeNull();
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    expect(
      await screen.findByRole("button", { name: "Sign in" }),
    ).toBeEnabled();
  });
});

describe("the promise", () => {
  it("is readable as text: the tagline as the page heading, then the three steps in order", async () => {
    renderApp("/login", { demoMode: false });
    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "AI reads, rules decide, people approve.",
      }),
    ).toBeInTheDocument();
    const steps = await screen.findByRole("list", {
      name: "How OrderPilot works",
    });
    const titles = within(steps)
      .getAllByRole("heading")
      .map((h) => h.textContent);
    expect(titles).toEqual(["AI reads", "Rules decide", "People approve"]);
    expect(steps).toHaveTextContent(
      "Business Central stays the system of record",
    );
  });

  it("puts the form first in the keyboard order and the theme switch last", async () => {
    const user = userEvent.setup();
    renderApp("/login", { demoMode: false });
    const email = await screen.findByLabelText("Email");
    // The skip link is first, as on every page; the form is the next stop.
    await user.tab();
    expect(
      screen.getByRole("link", { name: "Skip to main content" }),
    ).toHaveFocus();
    await user.tab();
    expect(email).toHaveFocus();
    const theme = screen.getByRole("button", { name: "Theme" });
    expect(
      email.compareDocumentPosition(theme) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });
});

describe("the form", () => {
  it("shows and hides the password with the eye", async () => {
    const user = userEvent.setup();
    renderApp("/login", { demoMode: false });
    const field = await screen.findByLabelText("Password");
    expect(field).toHaveAttribute("type", "password");
    await user.click(screen.getByRole("button", { name: "Show password" }));
    expect(field).toHaveAttribute("type", "text");
    expect(
      screen.getByRole("button", { name: "Show password" }),
    ).toHaveAttribute("aria-pressed", "true");
  });

  it("checks a field when it loses focus, with a message that says how to fix it", async () => {
    const user = userEvent.setup();
    renderApp("/login", { demoMode: false });
    const email = await screen.findByLabelText("Email");
    await user.type(email, "mei.tan");
    // Nothing is said while typing.
    expect(
      screen.queryByText(
        "That does not look like an email. Check for an @ and a domain.",
      ),
    ).toBeNull();
    await user.tab();
    expect(
      await screen.findByText(
        "That does not look like an email. Check for an @ and a domain.",
      ),
    ).toBeVisible();
    expect(email).toHaveAttribute("aria-invalid", "true");
    expect(email).toHaveAccessibleDescription(
      "That does not look like an email. Check for an @ and a domain.",
    );
  });

  it("shows which role it is signing in as while the answer is on its way", async () => {
    const user = userEvent.setup();
    renderApp("/login", { demoMode: true });
    const roles = await screen.findByRole("list", { name: "Demo roles" });
    await user.click(within(roles).getByRole("button", { name: /Finance/ }));
    // Every button waits, and the one that was pressed says it is busy.
    expect(
      within(roles).getByRole("button", { name: /Finance/ }),
    ).toHaveAttribute("aria-busy", "true");
    expect(
      within(roles).getByRole("button", { name: /Support/ }),
    ).toBeDisabled();
    await screen.findByRole("heading", {
      name: /^Good (morning|afternoon|evening), /,
    });
  });
});
