import {
  DEFAULT_DATA_SCOPES,
  DEFAULT_ROLE_PERMISSIONS,
  LOCKED_CELLS,
  PERMISSIONS,
  ROLES,
} from "@orderpilot/shared";
import { QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import i18n from "i18next";
import { HttpResponse, http } from "msw";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createQueryClient } from "@/lib/query";
import { errorBody, sessionFor } from "@/test/fixtures";
import { axeViolations } from "@/test/axe";
import { server } from "@/test/server";
import { useSessionStore } from "@/stores/session";
import GovernancePage from "./GovernancePage";

const matrix = {
  permissions: [...PERMISSIONS],
  roles: ROLES.map((role) => ({
    role,
    permissions: [...DEFAULT_ROLE_PERMISSIONS[role]],
    dataScope: DEFAULT_DATA_SCOPES[role],
  })),
  locked: [...LOCKED_CELLS],
};

function signIn(role: (typeof ROLES)[number]) {
  useSessionStore.getState().setSession(sessionFor(role));
}

function renderPage() {
  return render(
    <QueryClientProvider client={createQueryClient()}>
      <GovernancePage />
    </QueryClientProvider>,
  );
}

describe("GovernancePage", () => {
  beforeAll(async () => {
    await i18n.loadNamespaces("governance");
  });
  beforeEach(() => {
    server.use(
      http.get("*/api/v1/governance/matrix", () =>
        HttpResponse.json({ data: matrix }),
      ),
    );
  });

  it("shows the matrix with a switch per cell and no axe violations", async () => {
    signIn("SYSTEM_ADMIN");
    const { container } = renderPage();
    const table = await screen.findByRole("table", {
      name: "Permissions by role",
    });
    const cell = within(table).getByRole("switch", {
      name: "Confirm a payment for Finance",
    });
    expect(cell).toBeChecked();
    expect(await axeViolations(container)).toEqual([]);
  });

  it("locks the cells the system admin must never hold", async () => {
    signIn("SYSTEM_ADMIN");
    renderPage();
    const approve = await screen.findByRole("switch", {
      name: "Approve or reject for System admin",
    });
    expect(approve).toBeDisabled();
    expect(approve).not.toBeChecked();
  });

  it("saves a change to the real table and reloads the matrix", async () => {
    signIn("SYSTEM_ADMIN");
    let body: unknown = null;
    let path = "";
    server.use(
      http.put(
        "*/api/v1/governance/matrix/:role/permissions/:permission",
        async ({ request }) => {
          body = await request.json();
          path = new URL(request.url).pathname;
          return HttpResponse.json({ data: matrix.roles[0] });
        },
      ),
    );
    renderPage();
    const cell = await screen.findByRole("switch", {
      name: "Read orders for Warehouse",
    });
    await userEvent.click(cell);
    await waitFor(() => {
      expect(body).toEqual({ granted: false });
    });
    expect(path).toBe(
      "/api/v1/governance/matrix/WAREHOUSE/permissions/orders.read",
    );
  });

  it("is read-only for a role without roles.manage", async () => {
    signIn("AUDITOR");
    renderPage();
    const cell = await screen.findByRole("switch", {
      name: "Read orders for Warehouse",
    });
    expect(cell).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Copy a role" })).toBeNull();
  });

  it("copies one role onto another", async () => {
    signIn("SYSTEM_ADMIN");
    let body: unknown = null;
    server.use(
      http.post("*/api/v1/governance/matrix/copy", async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ data: matrix.roles[0] });
      }),
    );
    renderPage();
    await userEvent.click(
      await screen.findByRole("button", { name: "Copy a role" }),
    );
    await userEvent.selectOptions(
      screen.getByLabelText("Copy from"),
      "FINANCE",
    );
    await userEvent.selectOptions(
      screen.getByLabelText("Copy to"),
      "LOGISTICS",
    );
    await userEvent.click(screen.getByRole("button", { name: "Copy" }));
    await waitFor(() => {
      expect(body).toEqual({ fromRole: "FINANCE", toRole: "LOGISTICS" });
    });
  });

  it("shows a refusal with its trace id, not the rule", async () => {
    signIn("SYSTEM_ADMIN");
    server.use(
      http.get("*/api/v1/governance/matrix", () =>
        HttpResponse.json(errorBody("FORBIDDEN", "trace-refused-1"), {
          status: 403,
        }),
      ),
    );
    renderPage();
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("You do not have access");
    expect(alert).toHaveTextContent("trace-refused-1");
  });

  it("shows an error with retry when the matrix cannot load", async () => {
    signIn("SYSTEM_ADMIN");
    server.use(
      http.get("*/api/v1/governance/matrix", () =>
        HttpResponse.json(errorBody("INTERNAL_ERROR", "trace-500"), {
          status: 500,
        }),
      ),
    );
    renderPage();
    expect(
      await screen.findByRole(
        "button",
        { name: "Try again" },
        { timeout: 8000 },
      ),
    ).toBeInTheDocument();
  });

  it("shows an empty state with a next action", async () => {
    signIn("SYSTEM_ADMIN");
    server.use(
      http.get("*/api/v1/governance/matrix", () =>
        HttpResponse.json({ data: { ...matrix, roles: [] } }),
      ),
    );
    renderPage();
    expect(
      await screen.findByRole("button", { name: "Reload" }),
    ).toBeInTheDocument();
  });

  it("masks the sample note for a role the rule does not list", async () => {
    signIn("WAREHOUSE");
    server.use(
      http.get("*/api/v1/governance/masking/sample", () =>
        HttpResponse.json({
          data: {
            rules: [
              {
                field: "sample.customerNote",
                label: "Customer note (sample rule)",
                classification: "internal",
                reason: "role",
                visibleTo: ["SUPPORT"],
                sample: true,
              },
            ],
            records: [
              {
                customerNo: "C-1",
                customerName: "Synthetic Customer",
                note: {
                  field: "sample.customerNote",
                  classification: "internal",
                  masked: true,
                  value: null,
                  reason: "role",
                },
              },
            ],
          },
          meta: { mock: true },
        }),
      ),
    );
    renderPage();
    await userEvent.click(await screen.findByRole("tab", { name: "Masking" }));
    expect(await screen.findByText("Synthetic Customer")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Hidden" })).toBeInTheDocument();
    expect(
      screen.getByText("You are seeing this as Warehouse."),
    ).toBeInTheDocument();
  });

  it("disables a user rather than deleting them", async () => {
    signIn("SYSTEM_ADMIN");
    let called = "";
    const user = {
      id: "00000000-0000-4000-8000-000000000042",
      displayName: "Synthetic Person",
      email: "person@example.test",
      role: "SUPPORT",
      disabled: false,
      disabledAt: null,
      createdAt: new Date().toISOString(),
    };
    server.use(
      http.get("*/api/v1/users", () =>
        HttpResponse.json({
          data: [user],
          meta: { page: 1, pageSize: 100, total: 1 },
        }),
      ),
      http.post("*/api/v1/users/:id/disable", ({ params }) => {
        called = String(params.id);
        return HttpResponse.json({ data: { ...user, disabled: true } });
      }),
    );
    renderPage();
    await userEvent.click(await screen.findByRole("tab", { name: "Users" }));
    await userEvent.click(
      await screen.findByRole("button", { name: "Disable Synthetic Person" }),
    );
    await waitFor(() => {
      expect(called).toBe(user.id);
    });
    expect(screen.queryByRole("button", { name: /delete/i })).toBeNull();
  });

  it("refuses real data to every provider by default", async () => {
    signIn("SYSTEM_ADMIN");
    server.use(
      http.get("*/api/v1/governance/ai-destinations", () =>
        HttpResponse.json({
          data: [
            {
              provider: "mock",
              origins: ["synthetic"],
              classifications: ["public"],
            },
          ],
        }),
      ),
      http.post("*/api/v1/governance/ai-destinations/check", () =>
        HttpResponse.json({
          data: {
            allowed: false,
            rule: "synthetic-only",
            reason: "Only synthetic data may leave.",
          },
        }),
      ),
    );
    renderPage();
    await userEvent.click(
      await screen.findByRole("tab", { name: "Data sent to AI" }),
    );
    await userEvent.click(await screen.findByRole("button", { name: "Check" }));
    expect(await screen.findByText("Refused")).toBeInTheDocument();
    expect(
      screen.getByText("Only synthetic data may leave."),
    ).toBeInTheDocument();
  });

  it("shows how a refusal looks, in the page and in the envelope", async () => {
    signIn("SYSTEM_ADMIN");
    renderPage();
    await userEvent.click(await screen.findByRole("tab", { name: "Refusals" }));
    expect(await screen.findByText(/"code": "FORBIDDEN"/)).toBeInTheDocument();
    expect(screen.getByText("Sample, not a real refusal")).toBeInTheDocument();
  });
});
