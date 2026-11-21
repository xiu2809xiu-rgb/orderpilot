import { DEMO_PERSONAS, demoLoginRequestSchema } from "@orderpilot/shared";
import { QueryClientProvider, type QueryClient } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { registerDirtyForm } from "@/lib/dirty-forms";
import { apiClient } from "@/lib/api/instance";
import { createQueryClient, forgetShown } from "@/lib/query";
import type * as QueryModule from "@/lib/query";
import { useSessionStore } from "@/stores/session";
import { optionsFixture, sessionFor } from "@/test/fixtures";
import i18n from "@/i18n";
import { loadShellOverlays } from "./overlays/preload";
import { RoleSwitcher } from "./RoleSwitcher";

// Counts the resets, and still does them: the test below also looks at the cache.
vi.mock("@/lib/query", async (original) => {
  const real = await original<typeof QueryModule>();
  return { ...real, forgetShown: vi.fn(real.forgetShown) };
});

// A change of role drops what a form or a review holds, as signing out does,
// so it asks first, and only when something is unsaved.

beforeAll(async () => {
  await i18n.loadNamespaces(["common"]);
  await loadShellOverlays();
}, 60_000);

function json(body: unknown): Promise<Response> {
  return Promise.resolve(
    new Response(JSON.stringify(body), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }),
  );
}

const asked: string[] = [];

beforeEach(() => {
  asked.length = 0;
  vi.mocked(forgetShown).mockClear();
  vi.stubGlobal(
    "fetch",
    vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(
        input instanceof Request ? input.url : input.toString(),
        "http://localhost",
      );
      const path = url.pathname.replace("/api/v1", "");
      if (path === "/auth/options") return json({ data: optionsFixture(true) });
      if (path === "/auth/demo-login") {
        const body: unknown =
          typeof init?.body === "string" ? JSON.parse(init.body) : null;
        const role = demoLoginRequestSchema.parse(body).role;
        asked.push(role);
        return json({ data: sessionFor(role) });
      }
      return json({ data: [], meta: { page: 1, pageSize: 1, total: 0 } });
    }),
  );
  useSessionStore.setState({
    status: "active",
    session: sessionFor("SUPPORT"),
  });
  document.cookie = "op_csrf=csrf-token-1";
  apiClient.markSessionStarted();
});

afterEach(() => {
  vi.unstubAllGlobals();
  apiClient.reset();
});

function show(client: QueryClient = createQueryClient()) {
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={["/"]}>
        <RoleSwitcher />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

async function pickFinance(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole("button", { name: "Demo role" }));
  await user.click(
    await screen.findByRole("menuitem", {
      name: new RegExp(DEMO_PERSONAS.FINANCE),
    }),
  );
}

describe("a change of role over unsaved input", () => {
  it("switches at once when nothing is unsaved", async () => {
    const user = userEvent.setup();
    show();
    await pickFinance(user);
    await waitFor(() => {
      expect(asked).toEqual(["FINANCE"]);
    });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("asks first when a form holds unsaved input, and switches on the answer", async () => {
    const user = userEvent.setup();
    const forget = registerDirtyForm(() => true);
    const client = createQueryClient();
    // What the earlier role was given: gone once the new role has signed in.
    client.setQueryData(["earlier-role"], { rows: ["seen by Support"] });
    show(client);
    await pickFinance(user);
    const dialog = await screen.findByRole("dialog", { name: "Switch role?" });
    expect(dialog).toHaveTextContent(
      "Anything on this page that is not saved may be lost.",
    );
    expect(asked).toEqual([]);
    expect(client.getQueryData(["earlier-role"])).toBeDefined();
    await user.click(screen.getByRole("button", { name: "Switch role" }));
    await waitFor(() => {
      expect(asked).toEqual(["FINANCE"]);
    });
    await waitFor(() => {
      expect(client.getQueryData(["earlier-role"])).toBeUndefined();
    });
    expect(forgetShown).toHaveBeenCalledTimes(1);
    forget();
  });

  it("stays as the same person when asked to stay, and Escape is the same", async () => {
    const user = userEvent.setup();
    const forget = registerDirtyForm(() => true);
    show();
    await pickFinance(user);
    await user.click(await screen.findByRole("button", { name: "Stay here" }));
    expect(asked).toEqual([]);
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
    await pickFinance(user);
    await screen.findByRole("dialog", { name: "Switch role?" });
    await user.keyboard("{Escape}");
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
    expect(asked).toEqual([]);
    expect(useSessionStore.getState().session?.user.role).toBe("SUPPORT");
    forget();
  });

  it("puts Stay here in focus, so Enter never throws the input away", async () => {
    const user = userEvent.setup();
    const forget = registerDirtyForm(() => true);
    show();
    await pickFinance(user);
    await screen.findByRole("dialog", { name: "Switch role?" });
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Stay here" })).toHaveFocus();
    });
    forget();
  });

  it("returns focus to the Demo role button on every close, the first ask and the third, by mouse and by keyboard", async () => {
    const user = userEvent.setup();
    const forget = registerDirtyForm(() => true);
    show();
    const demoRole = await screen.findByRole("button", { name: "Demo role" });
    const closers: ((
      user: ReturnType<typeof userEvent.setup>,
    ) => Promise<void>)[] = [
      async (u) => {
        await u.click(screen.getByRole("button", { name: "Stay here" }));
      },
      async (u) => {
        await u.keyboard("{Escape}");
      },
      async (u) => {
        await u.keyboard("{Enter}");
      },
    ];
    for (const close of closers) {
      await pickFinance(user);
      await screen.findByRole("dialog", { name: "Switch role?" });
      await close(user);
      await waitFor(() => {
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      });
      await waitFor(() => {
        expect(demoRole).toHaveFocus();
      });
    }
    expect(asked).toEqual([]);
    forget();
  });
});
