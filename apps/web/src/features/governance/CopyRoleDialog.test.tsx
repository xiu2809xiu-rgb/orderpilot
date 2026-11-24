import {
  DEFAULT_DATA_SCOPES,
  LOCKED_CELLS,
  PERMISSIONS,
  ROLES,
  type Permission,
  type Role,
} from "@orderpilot/shared";
import { QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import i18n from "i18next";
import { HttpResponse, http } from "msw";
import { MemoryRouter } from "react-router";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createQueryClient } from "@/lib/query";
import { sessionFor } from "@/test/fixtures";
import { server } from "@/test/server";
import { useSessionStore } from "@/stores/session";
import GovernancePage from "./GovernancePage";

// A small matrix with sets known by heart, so each count below is written out:
// Finance holds four, Logistics two, and they share one.
const HOLDS: Partial<Record<Role, Permission[]>> = {
  SYSTEM_ADMIN: ["users.read", "users.manage", "roles.read", "roles.manage"],
  FINANCE: ["orders.read", "tracker.read", "audit.read", "exceptions.read"],
  LOGISTICS: ["orders.read", "documents.read"],
};
const matrix = {
  permissions: [...PERMISSIONS],
  roles: ROLES.map((role) => ({
    role,
    permissions: HOLDS[role] ?? [],
    dataScope: DEFAULT_DATA_SCOPES[role],
  })),
  locked: [...LOCKED_CELLS],
};

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/governance"]}>
      <QueryClientProvider client={createQueryClient()}>
        <GovernancePage />
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

async function openCopy() {
  await userEvent.click(
    await screen.findByRole("button", { name: "Copy a role" }),
  );
  return screen.findByRole("dialog");
}

describe("copying a role (#276)", () => {
  beforeAll(async () => {
    await i18n.loadNamespaces("governance");
  });
  beforeEach(() => {
    useSessionStore.getState().setSession(sessionFor("SYSTEM_ADMIN"));
    server.use(
      http.get("*/api/v1/governance/matrix", () =>
        HttpResponse.json({ data: matrix }),
      ),
    );
  });

  it("opens with no roles chosen, so one click cannot overwrite a role", async () => {
    renderPage();
    const dialog = await openCopy();
    expect(within(dialog).getByLabelText("Copy from")).toHaveValue("");
    expect(within(dialog).getByLabelText("Copy to")).toHaveValue("");
    expect(
      within(dialog).getAllByRole("option", { name: "Choose a role" }),
    ).toHaveLength(2);
    expect(within(dialog).getByRole("button", { name: "Copy" })).toBeDisabled();

    // One role chosen is still not enough.
    await userEvent.selectOptions(
      within(dialog).getByLabelText("Copy from"),
      "FINANCE",
    );
    expect(within(dialog).getByRole("button", { name: "Copy" })).toBeDisabled();
  });

  it("says how many permissions the target gains and loses, before and at the confirmation", async () => {
    renderPage();
    const dialog = await openCopy();
    await userEvent.selectOptions(
      within(dialog).getByLabelText("Copy from"),
      "FINANCE",
    );
    await userEvent.selectOptions(
      within(dialog).getByLabelText("Copy to"),
      "LOGISTICS",
    );
    const change = "Logistics gains 3 permissions and loses 1 permission.";
    expect(dialog).toHaveTextContent(change);
    await userEvent.click(within(dialog).getByRole("button", { name: "Copy" }));
    await waitFor(() => {
      expect(screen.getByRole("dialog")).toHaveTextContent(change);
    });
  });

  it("says when a copy would widen a role by only what it gains", async () => {
    renderPage();
    const dialog = await openCopy();
    await userEvent.selectOptions(
      within(dialog).getByLabelText("Copy from"),
      "SYSTEM_ADMIN",
    );
    await userEvent.selectOptions(
      within(dialog).getByLabelText("Copy to"),
      "AUDITOR",
    );
    expect(dialog).toHaveTextContent("Auditor gains 4 permissions.");
  });
});
