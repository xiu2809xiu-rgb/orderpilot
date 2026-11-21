import type { Permission, Role } from "@orderpilot/shared";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Inbox } from "lucide-react";
import { HttpResponse, http } from "msw";
import { MemoryRouter } from "react-router";
import { beforeAll, describe, expect, it } from "vitest";
import { CountTile } from "@/features/directions/screens/home/CountTile";
import i18n from "@/i18n";
import { allFeatures } from "@/features/registry";
import { axeViolations } from "@/test/axe";
import { sessionFor } from "@/test/fixtures";
import { server } from "@/test/server";
import { useSessionStore } from "@/stores/session";
import { loadShellOverlays } from "./overlays/preload";
import { PanelEntryRow } from "./PanelEntryRow";
import { SidePanel } from "./SidePanel";

beforeAll(async () => {
  await i18n.loadNamespaces([
    "common",
    "home",
    ...allFeatures.map((feature) => feature.namespace),
  ]);
  await loadShellOverlays();
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
  ui: React.ReactNode = <SidePanel collapsed={false} />,
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

describe("the side panel", () => {
  it("groups a role's entries by what people are doing, with Settings last", () => {
    serve({ tasks: 0, exceptions: 0 });
    renderIn("SYSTEM_ADMIN");
    const nav = screen.getByRole("navigation", { name: "Main navigation" });
    const headings = within(nav)
      .getAllByRole("heading", { level: 2 })
      .map((h) => h.textContent);
    expect(headings).toEqual(["Work", "Control"]);
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

  it("shows Orders once, and no row for the order tracker beside it", () => {
    serve({ tasks: 0, exceptions: 0 });
    renderIn("SUPPORT");
    const nav = screen.getByRole("navigation", { name: "Main navigation" });
    expect(
      within(nav)
        .getAllByRole("heading", { level: 2 })
        .map((h) => h.textContent),
    ).toEqual(["Work", "Master data"]);
    expect(within(nav).getAllByRole("link", { name: "Orders" })).toHaveLength(
      1,
    );
    expect(within(nav).getByRole("link", { name: "Orders" })).toHaveAttribute(
      "href",
      "/orders",
    );
    expect(within(nav).queryByText("Order tracker")).toBeNull();
    for (const name of ["Customers", "Vendors", "Items"]) {
      expect(within(nav).getByRole("link", { name })).toBeVisible();
    }
  });

  it("marks the open page and tells the Users and Roles tabs apart", () => {
    serve({ tasks: 0, exceptions: 0 });
    renderIn(
      "SYSTEM_ADMIN",
      <SidePanel collapsed={false} />,
      "/governance?tab=users",
    );
    expect(screen.getByRole("link", { name: "Users" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("link", { name: "Roles" })).not.toHaveAttribute(
      "aria-current",
    );
  });

  it("keeps Orders marked on an order and on the tracker's pages", () => {
    serve({ tasks: 0, exceptions: 0 });
    const view = renderIn(
      "SUPPORT",
      <SidePanel collapsed={false} />,
      "/orders/SO-0001",
    );
    expect(screen.getByRole("link", { name: "Orders" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    view.unmount();
    renderIn("SUPPORT", <SidePanel collapsed={false} />, "/order-tracker");
    expect(screen.getByRole("link", { name: "Orders" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("marks Settings when it is the open page", () => {
    serve({ tasks: 0, exceptions: 0 });
    renderIn("SUPPORT", <SidePanel collapsed={false} />, "/settings");
    expect(screen.getByRole("link", { name: "Settings" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("link", { name: "Home" })).not.toHaveAttribute(
      "aria-current",
    );
  });

  it("puts the count in the link's name for work that waits", async () => {
    serve({ tasks: 4, exceptions: 12 });
    renderIn("SUPPORT");
    expect(
      await screen.findByRole("link", { name: /^My tasks\s*4\s*waiting$/ }),
    ).toHaveAttribute("href", "/workflows");
    expect(
      await screen.findByRole("link", { name: /^Exceptions\s*12\s*waiting$/ }),
    ).toHaveAttribute("href", "/exceptions?state=OPEN");
    // Entries that hold no waiting work have no number.
    expect(screen.getByRole("link", { name: "Orders" })).toBeVisible();
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
      await screen.findByRole("link", { name: /^My tasks\s*9\s*waiting$/ }),
    ).toBeVisible();
    expect(screen.queryByRole("link", { name: /Exceptions/ })).toBeNull();
    expect(calls.exceptions).toBe(0);
  });

  it("makes no request when the role may not read the counted list", async () => {
    const calls = serve({ tasks: 9, exceptions: 9 });
    renderIn(
      "SUPPORT",
      <PanelEntryRow
        entry={{
          id: "test.exceptions",
          module: "reports",
          label: "common:nav.home",
          to: "/exceptions",
          icon: Inbox,
          count: { api: "/exceptions", permission: "audit.read" },
        }}
        current={false}
        collapsed={false}
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
        <SidePanel collapsed={false} />
        <CountTile
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
      await screen.findByRole("link", { name: /^My tasks\s*6\s*waiting$/ }),
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

  it("keeps help and the signed-in person at the foot, and opens the account menu from the person", async () => {
    const user = userEvent.setup();
    serve({ tasks: 0, exceptions: 0 });
    renderIn("SUPPORT");
    expect(screen.getByRole("button", { name: "Help" })).toBeVisible();
    const person = screen.getByRole("button", { name: /^Account menu/ });
    // The name and the role are what a person reads, so they are in the name too.
    expect(person).toHaveAccessibleName(/Mei Tan/);
    expect(person).toHaveAccessibleName(/Support/);
    await user.click(person);
    expect(
      await screen.findByRole("menuitem", { name: "Sign out" }),
    ).toBeVisible();
    expect(screen.getByRole("menuitem", { name: "Settings" })).toHaveAttribute(
      "href",
      "/settings",
    );
  });

  it("lists the keys that work on every page under Help", async () => {
    const user = userEvent.setup();
    serve({ tasks: 0, exceptions: 0 });
    renderIn("SUPPORT");
    await user.click(screen.getByRole("button", { name: "Help" }));
    const help = await screen.findByRole("dialog");
    expect(
      within(help).getByRole("heading", { name: "Keyboard shortcuts" }),
    ).toBeVisible();
    for (const does of [
      "Search or jump to a page",
      "Search the list on the page",
      "Start a new record",
      "Close a panel or a menu",
    ]) {
      expect(within(help).getByText(does)).toBeVisible();
    }
  });

  it("keeps every name for a screen reader when it is a rail", () => {
    serve({ tasks: 0, exceptions: 0 });
    renderIn("SUPPORT", <SidePanel collapsed />);
    for (const name of ["Home", "My tasks", "Orders", "Settings"]) {
      expect(screen.getByRole("link", { name })).toBeInTheDocument();
    }
    expect(screen.getByRole("button", { name: "Help" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /^Account menu/ }),
    ).toHaveAccessibleName(/Mei Tan/);
  });

  it("has no accessibility violations with counts showing", async () => {
    serve({ tasks: 4, exceptions: 120 });
    const { container } = renderIn("SUPPORT");
    await screen.findByRole("link", { name: /^Exceptions\s*99\+\s*waiting$/ });
    expect(await axeViolations(container)).toEqual([]);
  });
});
