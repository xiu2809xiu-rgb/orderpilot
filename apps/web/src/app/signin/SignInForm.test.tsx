import { QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import i18n from "@/i18n";
import { createQueryClient } from "@/lib/query";
import { errorBody, mockApi } from "@/test/fixtures";
import { SignInForm } from "../SignInForm";

beforeAll(async () => {
  await i18n.loadNamespaces("signin");
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function renderForm(props: { defaultEmail?: string; idPrefix?: string } = {}) {
  return render(
    <QueryClientProvider client={createQueryClient()}>
      <SignInForm {...props} />
    </QueryClientProvider>,
  );
}

/** The options request fails, and every other call goes to the fake API. */
function failingOptions() {
  const api = mockApi({ demoMode: true });
  return vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = input instanceof Request ? input.url : input.toString();
    return url.includes("/auth/options")
      ? Promise.resolve(
          new Response(JSON.stringify(errorBody("INTERNAL_ERROR")), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          }),
        )
      : api.fetch(input, init);
  });
}

const EMAIL = { name: "Email" };

describe("the sign-in form after a session ended", () => {
  it("opens the email form with the known email, above which the six teams still lead", async () => {
    vi.stubGlobal("fetch", mockApi({ demoMode: true }).fetch);
    renderForm({ defaultEmail: "mei@example.test", idPrefix: "expired" });
    await screen.findByRole("list", { name: "Demo roles" });
    expect(
      screen.getByRole("button", { name: "Sign in with email" }),
    ).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByLabelText("Email")).toBeVisible();
    expect(screen.getByLabelText("Email")).toHaveValue("mei@example.test");
  });

  // A person whose session ended is already in the form, so it is the one case
  // where the form is drawn while the roles load. It stays put when they arrive.
  it("keeps what was typed, and the focus, when the roles arrive", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      mockApi({ demoMode: true, optionsDelayMs: 300 }).fetch,
    );
    renderForm({ defaultEmail: "mei@example.test", idPrefix: "expired" });
    await user.click(await screen.findByLabelText("Email"));
    await user.keyboard("abc");
    await screen.findByRole("list", { name: "Demo roles" });
    await user.keyboard("def");
    expect(screen.getByLabelText("Email")).toHaveValue(
      "mei@example.testabcdef",
    );
    expect(screen.getByLabelText("Email")).toHaveFocus();
    expect(screen.getByLabelText("Email")).toBeVisible();
  });

  it("shows a sign-in failure once while the roles are still loading", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      mockApi({ demoMode: true, optionsDelayMs: 30_000 }).fetch,
    );
    renderForm({ defaultEmail: "mei@example.test", idPrefix: "expired" });
    await user.type(await screen.findByLabelText("Password"), "wrong{Enter}");
    await screen.findByRole("alert");
    // The roles are still on their way: only one place may draw the failure.
    expect(screen.queryByRole("list", { name: "Demo roles" })).toBeNull();
    expect(screen.getAllByRole("alert")).toHaveLength(1);
  });
});

describe("the sign-in form while the demo roles load", () => {
  it("holds the roles' place and does not draw the email form, which would show and fold away", async () => {
    vi.stubGlobal(
      "fetch",
      mockApi({ demoMode: true, optionsDelayMs: 200 }).fetch,
    );
    renderForm();
    // At once, and again part-way through the wait: never the form.
    expect(screen.getByTestId("roles-placeholder")).toBeInTheDocument();
    expect(screen.queryByRole("textbox", EMAIL)).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Sign in with email" }),
    ).toBeNull();
    await new Promise((resolve) => setTimeout(resolve, 80));
    expect(screen.queryByRole("textbox", EMAIL)).toBeNull();

    // The roles take the placeholder's place, and the form stays closed.
    await screen.findByRole("list", { name: "Demo roles" });
    expect(screen.queryByTestId("roles-placeholder")).toBeNull();
    expect(screen.queryByRole("textbox", EMAIL)).toBeNull();
    expect(
      screen.getByRole("button", { name: "Sign in with email" }),
    ).toHaveAttribute("aria-expanded", "false");
  });

  it("says in words, for a screen reader, that the roles are loading", () => {
    vi.stubGlobal(
      "fetch",
      mockApi({ demoMode: true, optionsDelayMs: 30_000 }).fetch,
    );
    renderForm();
    expect(screen.getByText("Loading the demo roles")).toBeInTheDocument();
  });

  it("shows the form, with no placeholder, when demo mode is off", async () => {
    vi.stubGlobal("fetch", mockApi({ demoMode: false }).fetch);
    renderForm();
    expect(await screen.findByRole("textbox", EMAIL)).toBeVisible();
    expect(screen.queryByTestId("roles-placeholder")).toBeNull();
    expect(screen.queryByRole("list", { name: "Demo roles" })).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Sign in with email" }),
    ).toBeNull();
  });

  it("shows the form, with no placeholder, when the roles cannot be loaded", async () => {
    vi.stubGlobal("fetch", failingOptions());
    renderForm();
    expect(await screen.findByRole("textbox", EMAIL)).toBeVisible();
    expect(screen.queryByTestId("roles-placeholder")).toBeNull();
    expect(
      screen.getByText(
        "The demo sign-in could not be checked. You can still sign in with your email.",
      ),
    ).toBeVisible();
  });
});
