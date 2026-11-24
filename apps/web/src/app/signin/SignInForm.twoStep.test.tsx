import { QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ErrorCode, Session } from "@orderpilot/shared";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { useToastStore } from "@/components/common/toast";
import i18n from "@/i18n";
import { apiClient } from "@/lib/api/instance";
import { createQueryClient } from "@/lib/query";
import { useSessionStore } from "@/stores/session";
import { axeViolations } from "@/test/axe";
import { errorBody, mockApi, sessionFor } from "@/test/fixtures";
import { SessionEndedDialog } from "../SessionEndedDialog";
import { SignInForm } from "../SignInForm";

beforeAll(async () => {
  await i18n.loadNamespaces(["signin", "common"]);
});

afterEach(() => {
  vi.unstubAllGlobals();
  useSessionStore.setState({ status: "booting", session: null });
  apiClient.reset();
});

type Verify =
  | {
      ok: true;
      method?: "code" | "recovery-code";
      left?: number;
      lock?: boolean;
    }
  | { ok: false; status: number; code: ErrorCode; retryAfter?: string };

/** The fake API of the auth contract, where a password sign-in asks for a second step. */
function twoStepApi(verifies: Verify[]) {
  const api = mockApi({ demoMode: false });
  const queue = [...verifies];
  const sent: unknown[] = [];
  const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(
      input instanceof Request ? input.url : input.toString(),
      "http://localhost",
    );
    const route = `${init?.method ?? "GET"} ${url.pathname.replace("/api/v1", "")}`;
    if (route === "POST /auth/login") {
      return Promise.resolve(
        new Response(JSON.stringify(errorBody("TWO_STEP_REQUIRED")), {
          status: 401,
        }),
      );
    }
    if (route === "POST /auth/two-step/verify") {
      sent.push(JSON.parse(init?.body as string));
      const next = queue.shift();
      if (!next) throw new Error("unexpected extra verify");
      if (!next.ok) {
        return Promise.resolve(
          new Response(JSON.stringify(errorBody(next.code)), {
            status: next.status,
            headers: next.retryAfter ? { "Retry-After": next.retryAfter } : {},
          }),
        );
      }
      const session: Session = { ...sessionFor("MANAGEMENT"), demo: false };
      return Promise.resolve(
        new Response(
          JSON.stringify({
            data: session,
            meta: {
              method: next.method ?? "code",
              recoveryCodesLeft: next.left ?? 8,
              lockedRecently: next.lock ?? false,
            },
          }),
          { status: 200 },
        ),
      );
    }
    return api.fetch(input, init);
  });
  return { fetch: fetchMock, sent };
}

function renderForm(onSignedIn = vi.fn()) {
  const ui = render(
    <QueryClientProvider client={createQueryClient()}>
      <SignInForm defaultEmail="mei@example.test" onSignedIn={onSignedIn} />
    </QueryClientProvider>,
  );
  return { ...ui, onSignedIn };
}

type User = ReturnType<typeof userEvent.setup>;

/** Password in, submit, and wait for the second step. */
async function reachSecondStep(user: User) {
  await user.type(
    await screen.findByLabelText("Password", { selector: "input" }),
    "right-pass{Enter}",
  );
  return screen.findByRole("heading", { name: "Enter your code" });
}

const codeInput = () =>
  screen.getByLabelText("6-digit code", { selector: "input" });
const field = () => codeInput().closest("[data-state]");
const stepHeading = () =>
  screen.queryByRole("heading", { name: "Enter your code" });
const password = () => screen.getByLabelText("Password", { selector: "input" });
const email = () => screen.getByLabelText("Email", { selector: "input" });
const toastMessages = () =>
  useToastStore.getState().items.map((item) => item.message);

describe("the second step of the sign-in form", () => {
  it("shows the second step when the password sign-in answers TWO_STEP_REQUIRED", async () => {
    vi.stubGlobal("fetch", twoStepApi([]).fetch);
    const user = userEvent.setup();
    renderForm();
    await reachSecondStep(user);
    await waitFor(() => {
      expect(codeInput()).toHaveFocus();
    });
    expect(
      screen.getByRole("button", { name: "Use a recovery code instead" }),
    ).toBeEnabled();
    // The password form stays mounted and hidden, with the email in place.
    expect(email()).toHaveValue("mei@example.test");
    expect(email()).not.toBeVisible();
    // The password does not sit in a hidden field during the step.
    expect(password()).toHaveValue("");
  });

  it("does not open the session until the code is verified", async () => {
    const api = twoStepApi([{ ok: true }]);
    vi.stubGlobal("fetch", api.fetch);
    const user = userEvent.setup();
    const { onSignedIn } = renderForm();
    await reachSecondStep(user);
    expect(useSessionStore.getState().status).toBe("booting");
    expect(onSignedIn).not.toHaveBeenCalled();
    await user.type(codeInput(), "123456");
    expect(useSessionStore.getState().status).toBe("booting");
    await waitFor(() => {
      expect(onSignedIn).toHaveBeenCalledTimes(1);
    });
    expect(api.sent).toEqual([{ code: "123456" }]);
    expect(useSessionStore.getState().status).toBe("active");
  });

  it("shows the failure and clears the code after a wrong one", async () => {
    const api = twoStepApi([
      { ok: false, status: 422, code: "TWO_STEP_CODE_INVALID" },
    ]);
    vi.stubGlobal("fetch", api.fetch);
    const user = userEvent.setup();
    renderForm();
    await reachSecondStep(user);
    await user.type(codeInput(), "111111");
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(
      "That code did not work. Wait for the next code",
    );
    expect(alert).toHaveTextContent("trace-test-1");
    await waitFor(() => {
      expect(codeInput()).toHaveValue("");
    });
    expect(codeInput()).toHaveFocus();
  });

  it("words a lock from the Retry-After header, in minutes and in hours", async () => {
    const api = twoStepApi([
      { ok: false, status: 429, code: "TWO_STEP_LOCKED", retryAfter: "900" },
      { ok: false, status: 429, code: "TWO_STEP_LOCKED", retryAfter: "86400" },
    ]);
    vi.stubGlobal("fetch", api.fetch);
    const user = userEvent.setup();
    renderForm();
    await reachSecondStep(user);
    await user.type(codeInput(), "111111");
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Too many wrong codes. Try again in 15 minutes, or use a recovery code.",
    );
    await waitFor(() => {
      expect(codeInput()).toHaveValue("");
    });
    await user.type(codeInput(), "222222");
    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Try again in 24 hours",
      );
    });
  });

  it("goes back to the password form when the challenge has ended, with the email still filled in and the password empty and focused", async () => {
    const api = twoStepApi([
      { ok: false, status: 401, code: "TWO_STEP_CHALLENGE_ENDED" },
    ]);
    vi.stubGlobal("fetch", api.fetch);
    const user = userEvent.setup();
    renderForm();
    await reachSecondStep(user);
    await user.type(codeInput(), "111111");
    await waitFor(() => {
      expect(stepHeading()).toBeNull();
    });
    expect(email()).toHaveValue("mei@example.test");
    expect(password()).toHaveValue("");
    await waitFor(() => {
      expect(password()).toHaveFocus();
    });
    expect(screen.getByRole("alert")).toHaveTextContent(
      "This sign-in has ended. Enter your email and password again.",
    );
  });

  it("leaves the fifth wrong code as an ended step without a shake", async () => {
    const api = twoStepApi([
      { ok: false, status: 401, code: "TWO_STEP_CHALLENGE_ENDED" },
    ]);
    vi.stubGlobal("fetch", api.fetch);
    const user = userEvent.setup();
    const { container } = renderForm();
    await reachSecondStep(user);
    const states = new Set<string>();
    const watch = new MutationObserver(() => {
      container
        .querySelectorAll("[data-state]")
        .forEach((node) => states.add(node.getAttribute("data-state") ?? ""));
    });
    watch.observe(container, {
      subtree: true,
      attributes: true,
      childList: true,
    });
    await user.type(codeInput(), "111111");
    await waitFor(() => {
      expect(stepHeading()).toBeNull();
    });
    watch.disconnect();
    expect(states.has("verifying")).toBe(true);
    expect(states.has("error")).toBe(false);
  });

  it("keeps Back, the recovery toggle and Verify disabled while a code is being verified and after it succeeded", async () => {
    vi.stubGlobal("fetch", twoStepApi([{ ok: true }]).fetch);
    const user = userEvent.setup();
    renderForm();
    await reachSecondStep(user);
    await user.type(codeInput(), "123456");
    const buttons = () => [
      screen.getByRole("button", { name: "Back to sign in" }),
      screen.getByRole("button", { name: "Use a recovery code instead" }),
      screen.getByRole("button", { name: "Verify" }),
    ];
    await waitFor(() => {
      expect(field()).toHaveAttribute("data-state", "verifying");
    });
    buttons().forEach((button) => {
      expect(button).toBeDisabled();
    });
    await waitFor(() => {
      expect(field()).toHaveAttribute("data-state", "success");
    });
    buttons().forEach((button) => {
      expect(button).toBeDisabled();
    });
  });

  it("keeps the digits and shows the network failure, so Verify is the retry", async () => {
    const api = twoStepApi([]);
    vi.stubGlobal(
      "fetch",
      vi.fn((input: RequestInfo | URL, init?: RequestInit) =>
        (input instanceof Request ? input.url : input.toString()).includes(
          "/two-step/verify",
        )
          ? Promise.reject(new TypeError("offline"))
          : api.fetch(input, init),
      ),
    );
    const user = userEvent.setup();
    renderForm();
    await reachSecondStep(user);
    await user.type(codeInput(), "123456");
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "could not reach the server",
    );
    expect(codeInput()).toHaveValue("123456");
    expect(screen.getByRole("button", { name: "Verify" })).toBeEnabled();
  });

  it("signs in with a recovery code and says how many are left", async () => {
    const api = twoStepApi([{ ok: true, method: "recovery-code", left: 7 }]);
    vi.stubGlobal("fetch", api.fetch);
    const user = userEvent.setup();
    const { onSignedIn } = renderForm();
    await reachSecondStep(user);
    await user.click(
      screen.getByRole("button", { name: "Use a recovery code instead" }),
    );
    await user.type(
      screen.getByLabelText("Recovery code"),
      "ABCDE-FGHJK-LMNPQ",
    );
    await user.click(screen.getByRole("button", { name: "Verify" }));
    await waitFor(() => {
      expect(onSignedIn).toHaveBeenCalledTimes(1);
    });
    expect(api.sent).toEqual([{ recoveryCode: "ABCDE-FGHJK-LMNPQ" }]);
    expect(toastMessages()).toEqual([
      "You signed in with a recovery code. 7 are left.",
    ]);
  });

  it("uses the last-code sentence when none is left, and asks for a code when the recovery box is empty", async () => {
    const api = twoStepApi([{ ok: true, method: "recovery-code", left: 0 }]);
    vi.stubGlobal("fetch", api.fetch);
    const user = userEvent.setup();
    renderForm();
    await reachSecondStep(user);
    await user.click(
      screen.getByRole("button", { name: "Use a recovery code instead" }),
    );
    await user.click(screen.getByRole("button", { name: "Verify" }));
    expect(
      screen.getByText("Enter one of your recovery codes."),
    ).toBeInTheDocument();
    expect(api.sent).toEqual([]);
    await user.type(
      screen.getByLabelText("Recovery code"),
      "ABCDE-FGHJK-LMNPQ{Enter}",
    );
    await waitFor(() => {
      expect(toastMessages()).toEqual([
        "You signed in with your last recovery code. Make new ones in Settings.",
      ]);
    });
  });

  it("shows the recent-lock warning when the verify answer says so", async () => {
    vi.stubGlobal("fetch", twoStepApi([{ ok: true, lock: true }]).fetch);
    const user = userEvent.setup();
    renderForm();
    await reachSecondStep(user);
    await user.type(codeInput(), "123456");
    await waitFor(() => {
      expect(toastMessages()).toContain(
        "Too many wrong codes were entered for your account in the last 7 days. If that was not you, someone may know your password.",
      );
    });
  });

  it("goes back to the password form with Back", async () => {
    vi.stubGlobal("fetch", twoStepApi([]).fetch);
    const user = userEvent.setup();
    renderForm();
    await reachSecondStep(user);
    await user.click(screen.getByRole("button", { name: "Back to sign in" }));
    expect(stepHeading()).toBeNull();
    await waitFor(() => {
      expect(password()).toHaveFocus();
    });
  });

  it("works inside the session-ended dialog", async () => {
    vi.stubGlobal("fetch", twoStepApi([{ ok: true }]).fetch);
    useSessionStore.setState({
      status: "expired",
      session: sessionFor("MANAGEMENT"),
    });
    const user = userEvent.setup();
    render(
      <QueryClientProvider client={createQueryClient()}>
        <SessionEndedDialog />
      </QueryClientProvider>,
    );
    await user.type(
      await screen.findByLabelText("Password", { selector: "input" }),
      "right-pass{Enter}",
    );
    await screen.findByRole("heading", { name: "Enter your code" });
    await user.keyboard("{Escape}");
    expect(stepHeading()).toBeInTheDocument();
    await user.type(codeInput(), "123456");
    await waitFor(() => {
      expect(useSessionStore.getState().status).toBe("active");
    });
  });

  it("has no axe violations in the code step and in the recovery step", async () => {
    vi.stubGlobal("fetch", twoStepApi([]).fetch);
    const user = userEvent.setup();
    const { container } = renderForm();
    await reachSecondStep(user);
    expect(await axeViolations(container)).toEqual([]);
    await user.click(
      screen.getByRole("button", { name: "Use a recovery code instead" }),
    );
    expect(await axeViolations(container)).toEqual([]);
  });
});
