import { act, screen } from "@testing-library/react";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Session } from "@orderpilot/shared";
import { useSessionStore } from "@/stores/session";
import { sessionFor } from "@/test/fixtures";
import { AccountPanel } from "./AccountPanel";
import { loadSettingsWords, renderSettings } from "./settingsTestKit";
import { OFF, serveStatus } from "./twoStepTestKit";

beforeAll(loadSettingsWords);
// The two-step card on this panel asks for its state.
beforeEach(() => {
  serveStatus(OFF);
});

/** The session changes while the section is on screen. */
function become(session: Session) {
  act(() => {
    useSessionStore.getState().setSession(session);
  });
}

describe("the account section", () => {
  it("says what the role is for, in words, under the person's name and email", () => {
    renderSettings(<AccountPanel />, { role: "FINANCE" });
    const session = sessionFor("FINANCE");
    expect(screen.getByText(session.user.displayName)).toBeInTheDocument();
    expect(screen.getByText(session.user.email)).toBeInTheDocument();
    expect(
      screen.getByText(
        "Confirms payments, pays vendors, and clears payment holds with a second approver.",
      ),
    ).toBeInTheDocument();
  });

  it("explains a demo session, and who changes the name and the role", () => {
    renderSettings(<AccountPanel />, { role: "SUPPORT" });
    expect(screen.getByText("Demo account")).toBeInTheDocument();
    expect(
      screen.getByText("Your name and email are set by a system admin."),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Your role is set by a system admin. If you need more access, ask them.",
      ),
    ).toBeInTheDocument();
  });

  it("does not tell the system admin to ask a system admin for a name change", () => {
    renderSettings(<AccountPanel />, { role: "SYSTEM_ADMIN" });
    expect(
      screen.queryByText("Your name and email are set by a system admin."),
    ).toBeNull();
  });

  it("does not tell the system admin to ask a system admin for more access", () => {
    renderSettings(<AccountPanel />, { role: "SYSTEM_ADMIN" });
    expect(
      screen.queryByText(
        "Your role is set by a system admin. If you need more access, ask them.",
      ),
    ).toBeNull();
  });

  it("shows no demo note outside a demo session", () => {
    renderSettings(<AccountPanel />, { role: "SUPPORT" });
    become({
      ...sessionFor("SUPPORT"),
      demo: false,
    });
    expect(screen.queryByText("Demo account")).toBeNull();
  });

  it("links to what every role can do only for a role that may read the matrix", () => {
    const support = renderSettings(<AccountPanel />, { role: "SUPPORT" });
    expect(
      screen.queryByRole("link", { name: "See what every role can do" }),
    ).toBeNull();
    support.unmount();
    renderSettings(<AccountPanel />, { role: "AUDITOR" });
    expect(
      screen.getByRole("link", { name: "See what every role can do" }),
    ).toHaveAttribute("href", "/governance?tab=matrix");
  });

  it("says so when the role holds nothing yet", () => {
    renderSettings(<AccountPanel />, { role: "SUPPORT" });
    become({
      ...sessionFor("SUPPORT"),
      permissions: [],
    });
    expect(
      screen.getByText(
        "Your role has no access yet. Ask a system admin to give you one.",
      ),
    ).toBeInTheDocument();
  });

  it("offers Sign out", () => {
    renderSettings(<AccountPanel />, { role: "SUPPORT" });
    expect(screen.getByRole("button", { name: "Sign out" })).toBeEnabled();
  });
});
