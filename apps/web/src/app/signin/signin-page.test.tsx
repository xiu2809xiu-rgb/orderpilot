import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, describe, expect, it } from "vitest";
import { axeViolations } from "@/test/axe";
import { errorBody } from "@/test/fixtures";
import { renderApp } from "@/test/render";

// The home page is a lazy route. Loading it here keeps its first import, which
// is slow on a busy machine, out of the five seconds a test waits for the page.
beforeAll(async () => {
  await import("@/features/directions/screens/home/HomeScreen");
}, 60_000);

/** The first state of the page with demo mode on: the six teams, both controls closed. */
async function sixTeams() {
  return screen.findByRole("list", { name: "Demo roles" });
}

describe("the sign-in page with demo mode on", () => {
  it("leads with the six teams in flow order, each with its number, its person and one line", async () => {
    renderApp("/login", { demoMode: true });
    const roles = await sixTeams();
    const buttons = within(roles).getAllByRole("button");
    expect(buttons).toHaveLength(6);
    expect(buttons.map((b) => b.textContent)).toEqual([
      "1SupportMei TanTakes in the customer's order and sends the proforma invoice",
      "2Product managerPriya NairWatches stock and run rate, and raises the request to buy",
      "3Management approverRachel GohApproves or rejects the request to buy",
      "4FinanceGrace OngConfirms the customer's payment",
      "5WarehouseHafiz RahmanPacks the goods and checks them against the papers",
      "6LogisticsArjun MehtaBooks the forwarder and follows the shipping papers",
    ]);
    // An ordered list says the order to a screen reader; the numbers are only for the eye.
    expect(roles.tagName).toBe("OL");
    expect(
      screen.getByRole("heading", {
        level: 2,
        name: "Open the demo as a team",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Six teams handle an order, in this order."),
    ).toBeInTheDocument();
    expect(screen.getByText("Synthetic demo data")).toBeInTheDocument();
  });

  it("has Sign in to OrderPilot as the page's one h1, and the tagline is not a heading", async () => {
    renderApp("/login", { demoMode: true });
    await sixTeams();
    const h1s = screen.getAllByRole("heading", { level: 1 });
    expect(h1s.map((h) => h.textContent)).toEqual(["Sign in to OrderPilot"]);
    expect(
      screen.queryByRole("heading", {
        name: "AI reads, rules decide, people approve.",
      }),
    ).toBeNull();
  });

  it("keeps More roles and the email form closed at first", async () => {
    renderApp("/login", { demoMode: true });
    await sixTeams();
    const more = screen.getByRole("button", { name: "More roles" });
    const email = screen.getByRole("button", { name: "Sign in with email" });
    expect(more).toHaveAttribute("aria-expanded", "false");
    expect(email).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByLabelText("More demo roles")).not.toBeVisible();
    expect(screen.getByLabelText("Email")).not.toBeVisible();
    expect(screen.getByLabelText("Password")).not.toBeVisible();
  });

  it("reveals the other roles, smaller and without numbers, under More roles", async () => {
    const user = userEvent.setup();
    renderApp("/login", { demoMode: true });
    await sixTeams();
    await user.click(screen.getByRole("button", { name: "More roles" }));
    expect(screen.getByRole("button", { name: "More roles" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    const others = screen.getByRole("list", { name: "More demo roles" });
    expect(
      within(others)
        .getAllByRole("button")
        .map((b) => b.textContent),
    ).toEqual([
      "System adminDaniel KohSets up users and roles",
      "ManagementSophia ChenReads the tracker and the KPIs",
      "AuditorLucas WongReads the audit trail",
    ]);
    // The six stay six, and the form is still closed.
    expect(
      within(screen.getByRole("list", { name: "Demo roles" })).getAllByRole(
        "button",
      ),
    ).toHaveLength(6);
    expect(screen.getByLabelText("Email")).not.toBeVisible();
  });

  it("signs in as a role under More roles", async () => {
    const user = userEvent.setup();
    renderApp("/login", { demoMode: true });
    await sixTeams();
    await user.click(screen.getByRole("button", { name: "More roles" }));
    await user.click(
      within(screen.getByRole("list", { name: "More demo roles" })).getByRole(
        "button",
        { name: /Auditor/ },
      ),
    );
    await screen.findByRole("heading", {
      name: /^Good (morning|afternoon|evening), Lucas/,
    });
  });

  it("opens the email and password form from Sign in with email", async () => {
    const user = userEvent.setup();
    renderApp("/login", { demoMode: true });
    await sixTeams();
    const toggle = screen.getByRole("button", { name: "Sign in with email" });
    await user.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByLabelText("Email")).toBeVisible();
    expect(screen.getByLabelText("Password")).toBeVisible();
    expect(screen.getByRole("button", { name: "Sign in" })).toBeVisible();
    await user.click(toggle);
    expect(screen.getByLabelText("Email")).not.toBeVisible();
  });

  it("signs in with one click", async () => {
    const user = userEvent.setup();
    const { router } = renderApp("/login", { demoMode: true });
    const roles = await sixTeams();
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
    await sixTeams();
    await user.keyboard("def");
    expect(screen.getByLabelText("Email")).toHaveValue("abcdef");
    expect(screen.getByLabelText("Email")).toHaveFocus();
    // The person is in the form, so it stays open under the roles.
    expect(screen.getByLabelText("Email")).toBeVisible();
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

  it("shows a failed role sign-in while the email form is closed", async () => {
    const user = userEvent.setup();
    const { fetch } = renderApp("/login", { demoMode: true });
    const roles = await sixTeams();
    const real = fetch.getMockImplementation();
    fetch.mockImplementation((input, init) =>
      (input instanceof Request ? input.url : input.toString()).endsWith(
        "/auth/demo-login",
      )
        ? Promise.resolve(
            new Response(JSON.stringify(errorBody("INTERNAL_ERROR")), {
              status: 500,
              headers: { "Content-Type": "application/json" },
            }),
          )
        : (real?.(input, init) ?? Promise.reject(new Error("no mock"))),
    );
    await user.click(within(roles).getByRole("button", { name: /Finance/ }));
    const alert = await screen.findByRole("alert");
    expect(alert).toBeVisible();
    expect(alert).toHaveTextContent("trace-test-1");
    expect(screen.getAllByRole("alert")).toHaveLength(1);
  });

  it("shows a failed password at the form's button when the form is open", async () => {
    const user = userEvent.setup();
    renderApp("/login", { demoMode: true });
    await sixTeams();
    await user.click(
      screen.getByRole("button", { name: "Sign in with email" }),
    );
    await user.type(screen.getByLabelText("Email"), "mei@example.test");
    await user.type(screen.getByLabelText("Password"), "wrong{Enter}");
    const alert = await screen.findByRole("alert");
    expect(alert).toBeVisible();
    expect(alert).toHaveTextContent("The email or password is not right.");
    expect(screen.getAllByRole("alert")).toHaveLength(1);
  });

  it("clears the server's error as soon as a field changes", async () => {
    const user = userEvent.setup();
    renderApp("/login", { demoMode: false });
    await user.type(await screen.findByLabelText("Email"), "mei@example.test");
    await user.type(screen.getByLabelText("Password"), "wrong{Enter}");
    await screen.findByRole("alert");
    await user.type(screen.getByLabelText("Password"), "x");
    await waitFor(() => {
      expect(screen.queryByRole("alert")).toBeNull();
    });
  });

  it("says the AI and Business Central are stand-ins", async () => {
    renderApp("/login", { demoMode: true });
    expect(await screen.findByText(/stand-ins/)).toBeInTheDocument();
  });

  it("draws the theme control in a box that gives it the app bar's two sizes", async () => {
    renderApp("/login", { demoMode: true });
    await sixTeams();
    const theme = screen.getByRole("button", { name: "Theme" });
    expect(theme.closest(".signin-theme")).not.toBeNull();
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
    // No disclosures: the form is simply there, as it always was.
    expect(screen.queryByRole("button", { name: "More roles" })).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Sign in with email" }),
    ).toBeNull();
    expect(screen.getByLabelText("Email")).toBeVisible();
    expect(
      await screen.findByRole("button", { name: "Sign in" }),
    ).toBeEnabled();
  });
});

describe("the promise", () => {
  it("is readable as text: the tagline, then the three steps in order", async () => {
    renderApp("/login", { demoMode: false });
    // The words sharpen in one by one, so they are separate spans.
    await waitFor(() => {
      expect(document.getElementById("signin-promise")).toHaveTextContent(
        "AI reads, rules decide, people approve.",
      );
    });
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

  it("has no accessibility violation", async () => {
    const { container } = renderApp("/login", { demoMode: true });
    await screen.findByRole("list", { name: "Demo roles" });
    expect(await axeViolations(container)).toEqual([]);
  }, 60_000);
});
