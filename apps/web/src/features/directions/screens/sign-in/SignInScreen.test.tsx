import { QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import i18n from "@/i18n";
import { createQueryClient } from "@/lib/query";
import { axeViolations } from "@/test/axe";
import { optionsFixture } from "@/test/fixtures";
import SignInScreen from "./SignInScreen";

function stubOptions() {
  vi.stubGlobal(
    "fetch",
    vi.fn(() =>
      Promise.resolve(
        new Response(JSON.stringify({ data: optionsFixture(true) }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    ),
  );
}

function signIn() {
  return render(
    <QueryClientProvider client={createQueryClient()}>
      <MemoryRouter initialEntries={["/login"]}>
        <Routes>
          <Route path="/login" element={<SignInScreen />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeAll(async () => {
  await i18n.loadNamespaces([
    "directions",
    "directions-home",
    "directions-parts",
  ]);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("the sign-in screen", () => {
  it("sets the tagline as the page heading, with the three steps", async () => {
    stubOptions();
    signIn();
    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "AI reads, rules decide, people approve.",
      }),
    ).toBeVisible();
    const steps = screen.getByRole("list", { name: "How OrderPilot works" });
    expect(within(steps).getAllByRole("listitem")).toHaveLength(3);
  });

  it("keeps the help line under each field and checks a field when it loses focus", async () => {
    stubOptions();
    const user = userEvent.setup();
    signIn();
    const email = await screen.findByRole("textbox", { name: "Email" });
    expect(
      screen.getByText("Use the email of your Spectra account."),
    ).toBeVisible();
    await user.type(email, "mei.tan");
    // Nothing is said while typing.
    expect(
      screen.queryByText(/does not look like an email/),
    ).not.toBeInTheDocument();
    await user.tab();
    expect(
      await screen.findByText(
        "That does not look like an email. Check for an @ and a domain.",
      ),
    ).toBeVisible();
    expect(email).toHaveAttribute("aria-invalid", "true");
    // The help stays beside the message.
    expect(
      screen.getByText("Use the email of your Spectra account."),
    ).toBeVisible();
    await user.type(screen.getByLabelText("Password"), "short");
    await user.tab();
    expect(await screen.findByText("Use at least 8 characters.")).toBeVisible();
  });

  it("shows and hides the password with the eye", async () => {
    stubOptions();
    const user = userEvent.setup();
    signIn();
    const field = await screen.findByLabelText("Password");
    expect(field).toHaveAttribute("type", "password");
    await user.click(screen.getByRole("button", { name: "Show password" }));
    expect(field).toHaveAttribute("type", "text");
    expect(
      screen.getByRole("button", { name: "Hide password" }),
    ).toHaveAttribute("aria-pressed", "true");
  });

  it("says that nothing was sent when a valid form is submitted", async () => {
    stubOptions();
    const user = userEvent.setup();
    signIn();
    await user.type(
      await screen.findByRole("textbox", { name: "Email" }),
      "mei.tan@example.com",
    );
    await user.type(screen.getByLabelText("Password"), "long enough password");
    await user.click(screen.getByRole("button", { name: "Sign in" }));
    expect(
      await screen.findByText(
        "Preview only: nothing was sent, and no one was signed in.",
      ),
    ).toBeVisible();
  });

  it("offers the nine demo roles, which only show a pressed state", async () => {
    stubOptions();
    const user = userEvent.setup();
    signIn();
    const roles = await screen.findByRole("list", { name: "Demo roles" });
    const buttons = within(roles).getAllByRole("button");
    expect(buttons).toHaveLength(9);
    const support = within(roles).getByRole("button", { name: /Support/ });
    expect(support).toHaveAttribute("aria-pressed", "false");
    await user.click(support);
    expect(support).toHaveAttribute("aria-pressed", "true");
    expect(
      screen.getByText(
        "Prototype: these buttons only show a pressed state. Sign in for real from the login page.",
      ),
    ).toBeVisible();
  });

  it("has no accessibility violation", async () => {
    stubOptions();
    const { container } = signIn();
    await screen.findByRole("list", { name: "Demo roles" });
    expect(await axeViolations(container)).toEqual([]);
  }, 60_000);
});
