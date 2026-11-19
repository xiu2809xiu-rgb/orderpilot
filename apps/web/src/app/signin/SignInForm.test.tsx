import { QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import i18n from "@/i18n";
import { createQueryClient } from "@/lib/query";
import { mockApi } from "@/test/fixtures";
import { SignInForm } from "../SignInForm";

beforeAll(async () => {
  await i18n.loadNamespaces("signin");
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("the sign-in form after a session ended", () => {
  it("opens the email form with the known email, above which the six teams still lead", async () => {
    vi.stubGlobal("fetch", mockApi({ demoMode: true }).fetch);
    render(
      <QueryClientProvider client={createQueryClient()}>
        <SignInForm defaultEmail="mei@example.test" idPrefix="expired" />
      </QueryClientProvider>,
    );
    await screen.findByRole("list", { name: "Demo roles" });
    expect(
      screen.getByRole("button", { name: "Sign in with email" }),
    ).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByLabelText("Email")).toBeVisible();
    expect(screen.getByLabelText("Email")).toHaveValue("mei@example.test");
  });
});
