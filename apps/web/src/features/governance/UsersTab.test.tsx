import { DEMO_PERSONAS, ROLES, type Role } from "@orderpilot/shared";
import { QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import i18n from "i18next";
import { HttpResponse, http } from "msw";
import { MemoryRouter } from "react-router";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createQueryClient } from "@/lib/query";
import { useSessionStore } from "@/stores/session";
import { sessionFor } from "@/test/fixtures";
import { server } from "@/test/server";
import { UsersTab } from "./UsersTab";

/** The same ids sessionFor gives, so the signed-in person is one of the rows. */
const users = ROLES.map((role: Role, index) => ({
  id: `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
  displayName: DEMO_PERSONAS[role],
  email: `${role.toLowerCase().replaceAll("_", ".")}@example.test`,
  role,
  disabled: false,
  disabledAt: null,
  createdAt: "2026-11-01T00:00:00.000Z",
}));

function renderTab() {
  return render(
    <MemoryRouter>
      <QueryClientProvider client={createQueryClient()}>
        <UsersTab />
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

describe("UsersTab", () => {
  beforeAll(async () => {
    await i18n.loadNamespaces(["governance", "components"]);
  });
  beforeEach(() => {
    useSessionStore.getState().setSession(sessionFor("SYSTEM_ADMIN"));
    server.use(
      http.get("*/api/v1/users", () =>
        HttpResponse.json({
          data: users,
          meta: { page: 1, pageSize: 100, total: users.length },
        }),
      ),
    );
  });

  it("offers no Disable on the signed-in person's own row, which the server would refuse", async () => {
    renderTab();
    const own = (await screen.findByText("Daniel Koh")).closest("tr");
    if (!own) throw new Error("no row");
    expect(within(own).getByText("You")).toBeVisible();
    expect(
      within(own).queryByRole("button", { name: "Disable Daniel Koh" }),
    ).toBeNull();
    expect(
      screen.getByRole("button", { name: "Disable Priya Nair" }),
    ).toBeVisible();
  });

  it("narrows the list by name, email or role as the person types", async () => {
    renderTab();
    await screen.findByText("Daniel Koh");
    const box = screen.getByRole("searchbox", {
      name: "Search users by name, email or role",
    });

    await userEvent.type(box, "finance");
    expect(await screen.findByText("Grace Ong")).toBeVisible();
    expect(screen.queryByText("Daniel Koh")).toBeNull();

    await userEvent.clear(box);
    await userEvent.type(box, "nobody-like-this");
    expect(await screen.findByText("No user matches")).toBeVisible();
  });
});
