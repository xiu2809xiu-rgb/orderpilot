import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useLocation } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import "@/i18n";
import { registerDirtyForm } from "@/lib/dirty-forms";
import { useSignOut } from "./useSignOut";

const logout = vi.fn<() => Promise<void>>();
vi.mock("@/lib/api/auth", () => ({ logout: () => logout() }));

function Probe() {
  const { requestSignOut, signingOut, dialog } = useSignOut();
  return (
    <>
      <button type="button" onClick={requestSignOut}>
        go
      </button>
      <output>{signingOut ? "signing out" : "idle"}</output>
      <p data-testid="where">{useLocation().pathname}</p>
      {dialog}
    </>
  );
}

function mount() {
  return render(
    <MemoryRouter>
      <Probe />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  logout.mockReset();
  logout.mockResolvedValue(undefined);
});

describe("useSignOut", () => {
  it("signs out at once when no form holds unsaved changes", async () => {
    mount();
    await userEvent.click(screen.getByRole("button", { name: "go" }));
    await waitFor(() => {
      expect(screen.getByTestId("where")).toHaveTextContent("/login");
    });
    expect(logout).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("asks first when a form holds unsaved changes, and does not sign out yet", async () => {
    const unregister = registerDirtyForm(() => true);
    mount();
    await userEvent.click(screen.getByRole("button", { name: "go" }));
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    expect(logout).not.toHaveBeenCalled();
    unregister();
  });

  it("goes on to the sign-in page even when the server call fails", async () => {
    logout.mockRejectedValue(new Error("network"));
    mount();
    await userEvent.click(screen.getByRole("button", { name: "go" }));
    await waitFor(() => {
      expect(screen.getByTestId("where")).toHaveTextContent("/login");
    });
    expect(logout).toHaveBeenCalledTimes(1);
    expect(screen.getByText("idle")).toBeInTheDocument();
  });
});
