import { REPEAT_WINDOW_MS } from "@/components/kit/availability-picker/openingPress";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it } from "vitest";
import { loadPicker } from "@/components/kit/availability-picker/availabilityTestKit";
import { apiClient } from "@/lib/api/instance";
import { useSessionStore } from "@/stores/session";
import { errorBody, sessionFor } from "@/test/fixtures";
import { must } from "@/test/must";
import { server } from "@/test/server";
import { UserMenu } from "./UserMenu";

const MINE = "*/api/v1/availability/mine";
const SET_AT = "2031-03-01T09:00:00.000Z";
const ENDS = "2031-03-01T21:00:00.000Z";
const free = { value: "AVAILABLE", setAt: null, expiresAt: null };

loadPicker();

beforeEach(() => {
  useSessionStore.getState().setSession(sessionFor("SUPPORT"));
  document.cookie = "op_csrf=csrf-token-1";
  apiClient.markSessionStarted();
});

/** The server holds one value, and every PUT is recorded. */
function serverHolding(start: object) {
  const puts: unknown[] = [];
  let held = start;
  server.use(
    http.get(MINE, () => HttpResponse.json({ data: held })),
    http.put(MINE, async ({ request }) => {
      const body = (await request.json()) as { value: string };
      puts.push(body);
      held = { value: body.value, setAt: SET_AT, expiresAt: ENDS };
      return HttpResponse.json({ data: held });
    }),
  );
  return puts;
}

function renderMenu(collapsed = false) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <UserMenu collapsed={collapsed} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const account = () => screen.getByRole("button", { name: /^Account menu/ });
const dot = () => screen.getByRole("button", { name: /^Your availability: / });

describe("the availability button in the side panel", () => {
  it("is a sibling after the account menu's button and not inside it", async () => {
    serverHolding(free);
    renderMenu();
    await screen.findByRole("button", { name: /^Your availability: / });
    expect(account().contains(dot())).toBe(false);
    expect(dot().closest("button")).toBe(dot());
    // Same row, after it in the DOM, so the row's own name is unchanged.
    expect(account().parentElement).toBe(dot().parentElement);
    expect(
      account().compareDocumentPosition(dot()) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(dot().parentElement).toHaveClass("dx-person-row");
  });

  it("leaves the account menu's name as it was", async () => {
    serverHolding(free);
    renderMenu();
    await screen.findByRole("button", { name: /^Your availability: / });
    expect(account()).toHaveAccessibleName("Account menu:Mei TanSupport");
    expect(
      screen.getAllByRole("button", { name: /^Account menu/ }),
    ).toHaveLength(1);
  });

  it("draws nothing while the value loads", async () => {
    server.use(
      http.get(MINE, async () => {
        await new Promise((resolve) => setTimeout(resolve, 200));
        return HttpResponse.json({ data: free });
      }),
    );
    renderMenu();
    expect(
      screen.queryByRole("button", { name: /^Your availability: / }),
    ).toBeNull();
    expect(account()).toBeVisible();
    await screen.findByRole("button", { name: /^Your availability: / });
  });

  it("draws nothing when the value cannot be read, and the account menu still works", async () => {
    let asked = 0;
    server.use(
      http.get(MINE, () => {
        asked += 1;
        return HttpResponse.json(errorBody("INTERNAL_ERROR"), { status: 500 });
      }),
    );
    renderMenu();
    await waitFor(() => {
      expect(asked).toBeGreaterThan(0);
    });
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(
      screen.queryByRole("button", { name: /^Your availability: / }),
    ).toBeNull();
    const user = userEvent.setup();
    await user.click(account());
    expect(
      await screen.findByRole("menuitem", { name: "Sign out" }),
    ).toBeVisible();
  });

  it("shows the value read from the server as its dot and its name", async () => {
    serverHolding({ value: "DO_NOT_DISTURB", setAt: SET_AT, expiresAt: ENDS });
    renderMenu();
    const button = await screen.findByRole("button", {
      name: "Your availability: Do not disturb. Change",
    });
    expect(button).toHaveAttribute("data-value", "DO_NOT_DISTURB");
    expect(button).toHaveClass("dx-person-dot");
  });

  it("opens the pill above the row with the panel open, and beside it in the rail", async () => {
    serverHolding(free);
    const user = userEvent.setup();
    const open = renderMenu(false);
    await user.click(
      await screen.findByRole("button", { name: /^Your availability: / }),
    );
    const above = await screen.findByRole("menu", {
      name: "Your availability",
    });
    expect(above).toHaveAttribute("data-side", "top");
    expect(above).toHaveAttribute("data-align", "start");
    open.unmount();
    renderMenu(true);
    await user.click(
      await screen.findByRole("button", { name: /^Your availability: / }),
    );
    const beside = await screen.findByRole("menu", {
      name: "Your availability",
    });
    expect(beside).toHaveAttribute("data-side", "right");
    expect(beside).toHaveAttribute("data-align", "end");
  });

  it("sends a PUT for a pick and changes the dot at once", async () => {
    const puts = serverHolding(free);
    const user = userEvent.setup();
    renderMenu();
    await user.click(
      await screen.findByRole("button", { name: /^Your availability: / }),
    );
    await screen.findByRole("menu");
    // jsdom puts every click on one point, so this pick is a press at the
    // opening press's place, which counts once REPEAT_WINDOW_MS has passed. In
    // a browser a choice lies somewhere else and the quarter second is enough.
    await new Promise((resolve) => setTimeout(resolve, REPEAT_WINDOW_MS + 20));
    await user.click(
      within(screen.getByRole("menu")).getByRole("menuitemradio", {
        name: "Do not disturb",
      }),
    );
    await waitFor(() => {
      expect(dot()).toHaveAttribute("data-value", "DO_NOT_DISTURB");
    });
    await waitFor(() => {
      expect(puts).toEqual([{ value: "DO_NOT_DISTURB" }]);
    });
    expect(dot()).toHaveAccessibleName(
      "Your availability: Do not disturb. Change",
    );
  });

  it("keeps the settings link and signing out in the account menu", async () => {
    serverHolding(free);
    const user = userEvent.setup();
    renderMenu();
    await screen.findByRole("button", { name: /^Your availability: / });
    await user.click(account());
    const menu = await screen.findByRole("menu");
    expect(
      within(menu).getByRole("menuitem", { name: "Settings" }),
    ).toHaveAttribute("href", "/settings");
    expect(
      within(menu).getByRole("menuitem", { name: "Sign out" }),
    ).toBeVisible();
    expect(must(within(menu).queryAllByRole("menuitemradio"))).toHaveLength(0);
  });
});
