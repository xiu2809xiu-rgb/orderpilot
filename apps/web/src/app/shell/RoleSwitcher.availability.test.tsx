import { DEMO_PERSONAS, ROLES, type Role } from "@orderpilot/shared";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { MemoryRouter } from "react-router";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { useSessionStore } from "@/stores/session";
import { errorBody, sessionFor } from "@/test/fixtures";
import { server } from "@/test/server";
import { loadShellOverlays } from "./overlays/preload";
import { RoleSwitcher } from "./RoleSwitcher";

beforeAll(async () => {
  await loadShellOverlays();
}, 60_000);

beforeEach(() => {
  useSessionStore.getState().setSession(sessionFor("PRODUCT_MANAGER"));
});

const idOf = (role: Role) =>
  `00000000-0000-4000-8000-${String(ROLES.indexOf(role) + 1).padStart(12, "0")}`;

function options(withIds: boolean, demoMode = true) {
  return {
    demoMode,
    demoRoles: demoMode
      ? ROLES.map((role) => ({
          role,
          displayName: DEMO_PERSONAS[role],
          ...(withIds ? { userId: idOf(role) } : {}),
        }))
      : [],
  };
}

/** Answers the options and the lookup, and counts both. */
function serve(state: {
  ids: boolean;
  demoMode?: boolean;
  values?: Partial<Record<Role, string>>;
  lookupFails?: boolean;
}) {
  const seen = { options: 0, lookups: [] as string[][] };
  server.use(
    http.get("*/api/v1/auth/options", () => {
      seen.options += 1;
      return HttpResponse.json({ data: options(state.ids, state.demoMode) });
    }),
    http.get("*/api/v1/availability", ({ request }) => {
      const asked = (new URL(request.url).searchParams.get("ids") ?? "").split(
        ",",
      );
      seen.lookups.push(asked);
      if (state.lookupFails) {
        return HttpResponse.json(errorBody("INTERNAL_ERROR"), { status: 500 });
      }
      return HttpResponse.json({
        data: asked.map((userId) => {
          const role = ROLES.find((r) => idOf(r) === userId);
          const value = (role && state.values?.[role]) ?? "AVAILABLE";
          return {
            userId,
            value,
            setAt: value === "AVAILABLE" ? null : "2031-03-01T09:00:00.000Z",
          };
        }),
      });
    }),
  );
  return seen;
}

function renderSwitcher() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <RoleSwitcher />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const trigger = () => screen.findByRole("button", { name: "Demo role" });
// A matcher, not a RegExp built from the persona: Semgrep blocks the latter.
const row = (role: Role) =>
  screen.getByRole("menuitem", {
    name: (name) => name.includes(DEMO_PERSONAS[role]),
  });

describe("the Demo role menu and availability", () => {
  it("asks once for the accounts the server named by id, and draws a dot and words on a row that is Focusing or on Do not disturb", async () => {
    const seen = serve({
      ids: true,
      values: { SUPPORT: "FOCUSING", FINANCE: "DO_NOT_DISTURB" },
    });
    renderSwitcher();
    const user = userEvent.setup();
    await user.click(await trigger());
    await screen.findByRole("menu");
    await waitFor(() => {
      expect(within(row("SUPPORT")).getByText("Focusing")).toBeInTheDocument();
    });
    expect(
      within(row("FINANCE")).getByText("Do not disturb"),
    ).toBeInTheDocument();
    expect(row("SUPPORT").querySelector(".ap-dot")).toHaveAttribute(
      "data-value",
      "FOCUSING",
    );
    // One request holds every offered id, read from the options.
    expect(seen.lookups[0]).toHaveLength(ROLES.length);
    expect(new Set(seen.lookups[0])).toEqual(new Set(ROLES.map(idOf)));
  });

  it("draws nothing on a row that is Available", async () => {
    serve({ ids: true, values: { SUPPORT: "FOCUSING" } });
    renderSwitcher();
    const user = userEvent.setup();
    await user.click(await trigger());
    await screen.findByRole("menu");
    await waitFor(() => {
      expect(within(row("SUPPORT")).getByText("Focusing")).toBeInTheDocument();
    });
    for (const role of ROLES.filter((r) => r !== "SUPPORT")) {
      expect(row(role).querySelector(".ap-dot")).toBeNull();
      expect(within(row(role)).queryByText("Available")).toBeNull();
    }
  });

  it("sends no request and draws no dot when the options carry no ids", async () => {
    const seen = serve({ ids: false });
    renderSwitcher();
    const user = userEvent.setup();
    await user.click(await trigger());
    await screen.findByRole("menu");
    await new Promise((resolve) => setTimeout(resolve, 80));
    expect(seen.lookups).toHaveLength(0);
    expect(document.querySelector(".ap-dot")).toBeNull();
  });

  it("is not drawn at all outside demo mode, and asks nothing", async () => {
    const seen = serve({ ids: false, demoMode: false });
    renderSwitcher();
    await waitFor(() => {
      expect(seen.options).toBe(1);
    });
    expect(screen.queryByRole("button", { name: "Demo role" })).toBeNull();
    expect(seen.lookups).toHaveLength(0);
  });

  it("leaves the menu as it is when the lookup fails", async () => {
    serve({ ids: true, lookupFails: true });
    renderSwitcher();
    const user = userEvent.setup();
    await user.click(await trigger());
    const menu = await screen.findByRole("menu");
    expect(within(menu).getAllByRole("menuitem")).toHaveLength(ROLES.length);
    expect(document.querySelector(".ap-dot")).toBeNull();
    expect(row("SUPPORT")).toBeVisible();
  });

  it("asks again, for the options and the lookup, each time the menu opens", async () => {
    const seen = serve({ ids: true });
    renderSwitcher();
    const user = userEvent.setup();
    await user.click(await trigger());
    await screen.findByRole("menu");
    await waitFor(() => {
      expect(seen.lookups.length).toBeGreaterThanOrEqual(1);
    });
    const before = { options: seen.options, lookups: seen.lookups.length };
    await user.keyboard("{Escape}");
    await waitFor(() => {
      expect(screen.queryByRole("menu")).toBeNull();
    });
    await user.click(await trigger());
    await screen.findByRole("menu");
    await waitFor(() => {
      expect(seen.options).toBeGreaterThan(before.options);
      expect(seen.lookups.length).toBeGreaterThan(before.lookups);
    });
  });

  it("draws the current role's own row like the others", async () => {
    serve({ ids: true, values: { PRODUCT_MANAGER: "DO_NOT_DISTURB" } });
    renderSwitcher();
    const user = userEvent.setup();
    await user.click(await trigger());
    await screen.findByRole("menu");
    await waitFor(() => {
      expect(
        within(row("PRODUCT_MANAGER")).getByText("Do not disturb"),
      ).toBeInTheDocument();
    });
  });
});
