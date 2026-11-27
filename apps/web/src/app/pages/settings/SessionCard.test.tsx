import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { registerDirtyForm } from "@/lib/dirty-forms";
import { loadSettingsWords, renderSettings } from "./settingsTestKit";
import { SessionCard } from "./SessionCard";

const logout = vi.fn<() => Promise<void>>();
vi.mock("@/lib/api/auth", () => ({ logout: () => logout() }));

beforeAll(loadSettingsWords);

beforeEach(() => {
  logout.mockReset();
  logout.mockResolvedValue(undefined);
});

describe("Sign out on the Account panel", () => {
  it("keeps its name and its icon, and is described by the row's line", () => {
    renderSettings(<SessionCard />);
    const button = screen.getByRole("button", { name: "Sign out" });
    expect(button.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
    expect(button).toHaveAccessibleDescription(/^You are signed in as /);
  });

  it("uses the destructive border and words, not the destructive fill", () => {
    renderSettings(<SessionCard />);
    const button = screen.getByRole("button", { name: "Sign out" });
    expect(button).toHaveAttribute("data-variant", "outline");
    expect(button).toHaveClass("border-destructive", "text-destructive");
    expect(button).toHaveClass("dark:border-destructive", "dark:bg-background");
    expect(button).not.toHaveClass("dark:bg-input/30");
    expect(button).not.toHaveClass("bg-destructive");
  });

  it("asks first, with the same dialog, when a form holds unsaved changes", async () => {
    const unregister = registerDirtyForm(() => true);
    renderSettings(<SessionCard />);
    await userEvent.click(screen.getByRole("button", { name: "Sign out" }));
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    expect(logout).not.toHaveBeenCalled();
    unregister();
  });

  it("signs out at once when nothing is unsaved", async () => {
    renderSettings(<SessionCard />);
    await userEvent.click(screen.getByRole("button", { name: "Sign out" }));
    await waitFor(() => {
      expect(logout).toHaveBeenCalledTimes(1);
    });
  });
});
