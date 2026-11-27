import { QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import i18n from "@/i18n";
import { apiClient } from "@/lib/api/instance";
import { createQueryClient } from "@/lib/query";
import { useSessionStore } from "@/stores/session";
import { errorBody, mockApi } from "@/test/fixtures";
import { SignInForm } from "../SignInForm";

// The chunk of the second step cannot be loaded, as after a stale deploy.
vi.mock("./TwoStepStep", () => {
  throw new Error("Failed to fetch dynamically imported module");
});

beforeAll(async () => {
  await i18n.loadNamespaces(["signin", "common"]);
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  useSessionStore.setState({ status: "booting", session: null });
  apiClient.reset();
});

describe("the sign-in form when the second step cannot be loaded", () => {
  it("stays on the page with the failure and a way back to the password form", async () => {
    const api = mockApi({ demoMode: false });
    vi.stubGlobal(
      "fetch",
      vi.fn((input: RequestInfo | URL, init?: RequestInit) =>
        (input instanceof Request ? input.url : input.toString()).includes(
          "/auth/login",
        )
          ? Promise.resolve(
              new Response(JSON.stringify(errorBody("TWO_STEP_REQUIRED")), {
                status: 401,
              }),
            )
          : api.fetch(input, init),
      ),
    );
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const user = userEvent.setup();
    render(
      <QueryClientProvider client={createQueryClient()}>
        <SignInForm defaultEmail="mei@example.test" />
      </QueryClientProvider>,
    );
    await user.type(
      await screen.findByLabelText("Password", { selector: "input" }),
      "right-pass{Enter}",
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "The second step could not be loaded",
    );
    await user.click(screen.getByRole("button", { name: "Back to sign in" }));

    expect(screen.queryByRole("alert")).toBeNull();
    expect(
      screen.getByLabelText("Password", { selector: "input" }),
    ).toBeVisible();
    expect(screen.getByLabelText("Email", { selector: "input" })).toHaveValue(
      "mei@example.test",
    );
  });
});
