import { QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import i18n from "i18next";
import { HttpResponse, http } from "msw";
import { MemoryRouter } from "react-router";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { Toaster } from "@/components/common";
import { useToastStore } from "@/components/common/toast";
import { createQueryClient } from "@/lib/query";
import { axeViolations } from "@/test/axe";
import { sessionFor } from "@/test/fixtures";
import { server } from "@/test/server";
import { useSessionStore } from "@/stores/session";
import { UsersTab } from "./UsersTab";

const admin = sessionFor("SYSTEM_ADMIN");
const CREATED = "2026-11-01T00:00:00.000Z";
// The signed-in administrator's own row, and someone else's. Synthetic.
const me = {
  id: admin.user.id,
  displayName: admin.user.displayName,
  email: admin.user.email,
  role: "SYSTEM_ADMIN",
  disabled: false,
  disabledAt: null,
  createdAt: CREATED,
};
const other = {
  id: "00000000-0000-4000-8000-000000000042",
  displayName: "Synthetic Person",
  email: "person@example.test",
  role: "SUPPORT",
  disabled: false,
  disabledAt: null,
  createdAt: CREATED,
};

function serveUsers() {
  server.use(
    http.get("*/api/v1/users", () =>
      HttpResponse.json({
        data: [me, other],
        meta: { page: 1, pageSize: 100, total: 2 },
      }),
    ),
  );
}

/** The server refuses a disable with this status and words, as its envelope says them. */
function refuseDisable(status: number, code: string, message: string) {
  server.use(
    http.post("*/api/v1/users/:id/disable", () =>
      HttpResponse.json(
        { error: { code, message, details: null, traceId: "trace-users-9" } },
        { status },
      ),
    ),
  );
}

function renderTab() {
  return render(
    <MemoryRouter>
      <QueryClientProvider client={createQueryClient()}>
        <UsersTab />
        <Toaster />
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

async function rowOf(name: string): Promise<HTMLElement> {
  const cell = await screen.findByText(name);
  const row = cell.closest("tr");
  if (!(row instanceof HTMLElement)) throw new Error(`No row for ${name}`);
  return row;
}

describe("the users tab (#276)", () => {
  beforeAll(async () => {
    await i18n.loadNamespaces(["governance", "components"]);
  });
  beforeEach(() => {
    useToastStore.setState({ items: [] });
    useSessionStore.getState().setSession(admin);
    serveUsers();
  });

  it("offers no Disable on your own row, and says the row is you", async () => {
    renderTab();
    const mine = await rowOf(me.displayName);
    expect(within(mine).queryByRole("button", { name: /^Disable/ })).toBeNull();
    expect(within(mine).getByText("You")).toBeVisible();
    // The history of your own account is still there to read.
    expect(
      within(mine).getByRole("button", {
        name: `History of ${me.displayName}`,
      }),
    ).toBeVisible();
    // Everyone else's row keeps its Disable.
    const theirs = await rowOf(other.displayName);
    expect(
      within(theirs).getByRole("button", { name: "Disable Synthetic Person" }),
    ).toBeVisible();
    expect(within(theirs).queryByText("You")).toBeNull();
  });

  it("says why the server refused a change, with its trace ID, and not as a load error", async () => {
    refuseDisable(409, "CONFLICT", "You cannot disable your own account.");
    renderTab();
    await userEvent.click(
      await screen.findByRole("button", { name: "Disable Synthetic Person" }),
    );
    await waitFor(() => {
      expect(useToastStore.getState().items.at(-1)).toMatchObject({
        kind: "error",
        message: "The change was not saved",
        description:
          "You cannot disable your own account. Trace ID: trace-users-9",
      });
    });
    expect(screen.queryByText(/Someone else changed this first/)).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("still shows an access refusal above the table, with its trace ID", async () => {
    refuseDisable(403, "FORBIDDEN", "You do not have access to this.");
    renderTab();
    await userEvent.click(
      await screen.findByRole("button", { name: "Disable Synthetic Person" }),
    );
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("trace-users-9");
  });

  it("has no axe violations with your own row in the list", async () => {
    const { container } = renderTab();
    await rowOf(me.displayName);
    expect(await axeViolations(container)).toEqual([]);
  });
});
