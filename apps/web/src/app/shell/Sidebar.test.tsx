import type { Permission, Role } from "@orderpilot/shared";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import { Inbox } from "lucide-react";
import { HttpResponse, http } from "msw";
import { MemoryRouter } from "react-router";
import { beforeAll, describe, expect, it } from "vitest";
import { HomeTile } from "@/app/pages/home/HomeTile";
import i18n from "@/i18n";
import { allFeatures } from "@/features/registry";
import { axeViolations } from "@/test/axe";
import { sessionFor } from "@/test/fixtures";
import { server } from "@/test/server";
import { useSessionStore } from "@/stores/session";
import { MenuLink } from "./MenuLink";
import { SidebarNav } from "./Sidebar";

beforeAll(async () => {
  await i18n.loadNamespaces([
    "common",
    "home",
    ...allFeatures.map((feature) => feature.namespace),
  ]);
});

function list(total: number) {
  return HttpResponse.json({
    data: [],
    meta: { page: 1, pageSize: 1, total },
  });
}

/** Counts the requests each list gets, and answers with a fixed total. */
function serve(totals: { tasks: number; exceptions: number }) {
  const calls = { tasks: 0, exceptions: 0 };
  server.use(
    http.get("*/api/v1/workflows/tasks", () => {
      calls.tasks += 1;
      return list(totals.tasks);
    }),
    http.get("*/api/v1/exceptions", () => {
      calls.exceptions += 1;
      return list(totals.exceptions);
    }),
  );
  return calls;
}

function renderIn(
  role: Role,
  ui: React.ReactNode = <SidebarNav />,
  path = "/",
  permissions?: readonly Permission[],
) {
  const session = sessionFor(role);
  useSessionStore
    .getState()
    .setSession(
      permissions ? { ...session, permissions: [...permissions] } : session,
    );
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>{ui}</MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("the sidebar menu", () => {
  it("groups a role's entries under its modules and leaves Home unlabelled", () => {
    serve({ tasks: 0, exceptions: 0 });
    renderIn("SYSTEM_ADMIN");
    const nav = screen.getByRole("navigation", { name: "Main navigation" });
    const headings = within(nav)
      .getAllByRole("heading")
      .map((h) => h.textContent);
    expect(headings).toEqual(["System"]);
    expect(
      within(nav)
        .getAllByRole("link")
        .map((l) => l.textContent),
    ).toEqual([
      "Home",
      "Users",
      "Roles",
      "Audit log",
      "Monitoring",
      "Settings",
    ]);
  });

  it("marks the open page and tells the Users and Roles tabs apart", () => {
    serve({ tasks: 0, exceptions: 0 });
    renderIn("SYSTEM_ADMIN", <SidebarNav />, "/governance?tab=users");
    expect(screen.getByRole("link", { name: "Users" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("link", { name: "Roles" })).not.toHaveAttribute(
      "aria-current",
    );
  });

  it("puts the count in the link's name for work that waits", async () => {
    serve({ tasks: 4, exceptions: 12 });
    renderIn("SUPPORT");
    expect(
      await screen.findByRole("link", { name: "My tasks, 4 waiting" }),
    ).toHaveAttribute("href", "/workflows");
    expect(
      await screen.findByRole("link", { name: "Exceptions, 12 waiting" }),
    ).toHaveAttribute("href", "/exceptions?state=OPEN");
    // Entries that hold no waiting work have no number.
    expect(screen.getByRole("link", { name: "Order tracker" })).toBeVisible();
  });

  it("shows no number for an empty list", async () => {
    const calls = serve({ tasks: 0, exceptions: 0 });
    renderIn("SUPPORT");
    await waitFor(() => {
      expect(calls.tasks).toBe(1);
    });
    expect(screen.getByRole("link", { name: "My tasks" })).toBeVisible();
  });

  it("asks nothing about a list the role has no entry for", async () => {
    const calls = serve({ tasks: 9, exceptions: 9 });
    // The approver has an inbox and no right to read exceptions.
    renderIn("APPROVER");
    expect(
      await screen.findByRole("link", { name: "My tasks, 9 waiting" }),
    ).toBeVisible();
    expect(screen.queryByRole("link", { name: /Exceptions/ })).toBeNull();
    expect(calls.exceptions).toBe(0);
  });

  it("makes no request when the role may not read the counted list", async () => {
    const calls = serve({ tasks: 9, exceptions: 9 });
    renderIn(
      "SUPPORT",
      <MenuLink
        entry={{
          id: "test.exceptions",
          module: "reports",
          label: "common:nav.home",
          to: "/exceptions",
          icon: Inbox,
          count: { api: "/exceptions", permission: "audit.read" },
        }}
      />,
    );
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(calls.exceptions).toBe(0);
  });

  it("shares one request between a home tile and the menu count", async () => {
    const calls = serve({ tasks: 6, exceptions: 0 });
    renderIn(
      "SUPPORT",
      <>
        <SidebarNav />
        <HomeTile
          cue={{
            id: "myTasks",
            roles: ["SUPPORT"],
            to: "/workflows",
            api: "/workflows/tasks",
          }}
        />
      </>,
    );
    expect(
      await screen.findByRole("link", { name: "My tasks, 6 waiting" }),
    ).toBeVisible();
    expect(
      await screen.findByRole("link", { name: /^My tasks\s*6$/ }),
    ).toBeVisible();
    expect(calls.tasks).toBe(1);
  });

  it("keeps the menu up when a count fails", async () => {
    server.use(
      http.get("*/api/v1/workflows/tasks", () =>
        HttpResponse.json(
          { error: { code: "INTERNAL_ERROR" } },
          { status: 500 },
        ),
      ),
      http.get("*/api/v1/exceptions", () => list(0)),
    );
    renderIn("SUPPORT");
    expect(await screen.findByRole("link", { name: "My tasks" })).toBeVisible();
  });

  it("has no accessibility violations with counts showing", async () => {
    serve({ tasks: 4, exceptions: 120 });
    const { container } = renderIn("SUPPORT");
    await screen.findByRole("link", { name: "Exceptions, 120 waiting" });
    expect(await axeViolations(container)).toEqual([]);
  });
});
