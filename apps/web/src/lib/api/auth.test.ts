import type { Role } from "@orderpilot/shared";
import { QueryObserver } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { queryClient } from "@/lib/query";
import { useSessionStore } from "@/stores/session";
import { sessionFor } from "@/test/fixtures";
import { demoLogin, logout } from "./auth";
import { apiClient } from "./instance";

// The server masks by role. These tests hold the other half: an answer the
// browser already keeps must not be drawn for the next person at the same tab.

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

/** A tiny API: the demo sign-in answers with that role's session, sign-out with ok. */
function stubAuth(options: { signOutFails?: boolean } = {}) {
  vi.stubGlobal(
    "fetch",
    vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.href
            : input.url,
        "http://localhost",
      );
      if (url.pathname.endsWith("/auth/demo-login")) {
        const { role } = JSON.parse(
          typeof init?.body === "string" ? init.body : "{}",
        ) as { role: Role };
        return Promise.resolve(json(200, { data: sessionFor(role) }));
      }
      if (url.pathname.endsWith("/auth/logout")) {
        return options.signOutFails
          ? Promise.reject(new TypeError("Failed to fetch"))
          : Promise.resolve(json(200, { data: { ok: true } }));
      }
      return Promise.resolve(
        json(404, {
          error: {
            code: "NOT_FOUND",
            message: "x",
            details: null,
            traceId: "trace-auth-test",
          },
        }),
      );
    }),
  );
}

/** Something on screen: a query with a watcher, as a mounted list has. Returns how often it was asked. */
function onScreen(key: string) {
  const asked = { times: 0 };
  const observer = new QueryObserver(queryClient, {
    queryKey: [key],
    queryFn: () => {
      asked.times += 1;
      return Promise.resolve(`answer ${String(asked.times)}`);
    },
  });
  const stop = observer.subscribe(() => undefined);
  return { asked, stop };
}

beforeEach(() => {
  queryClient.clear();
  apiClient.reset();
  useSessionStore.setState({ status: "booting", session: null });
});

afterEach(() => {
  vi.unstubAllGlobals();
  queryClient.clear();
  apiClient.reset();
  useSessionStore.setState({ status: "booting", session: null });
});

describe("signing out", () => {
  it("leaves none of the answers the browser kept for the person who signed out", async () => {
    stubAuth();
    useSessionStore.getState().setSession(sessionFor("FINANCE"));
    queryClient.setQueryData(["vendor", "V-0007"], {
      accountNo: "000000000007",
    });
    queryClient.setQueryData(["vendors"], [{ no: "V-0007" }]);

    await logout();

    expect(queryClient.getQueryCache().getAll()).toHaveLength(0);
    expect(useSessionStore.getState().status).toBe("anonymous");
  });

  it("leaves none even when the server could not be reached", async () => {
    stubAuth({ signOutFails: true });
    useSessionStore.getState().setSession(sessionFor("FINANCE"));
    queryClient.setQueryData(["vendor", "V-0007"], {
      accountNo: "000000000007",
    });

    await expect(logout()).rejects.toThrow();

    expect(queryClient.getQueryCache().getAll()).toHaveLength(0);
    expect(useSessionStore.getState().status).toBe("anonymous");
  });
});

describe("signing in over a session that ended while its page was open", () => {
  it("asks again, as the new person, for what is on screen, and drops what was only kept", async () => {
    stubAuth();
    useSessionStore.getState().setSession(sessionFor("FINANCE"));
    const page = onScreen("on-screen");
    await vi.waitFor(() => {
      expect(page.asked.times).toBe(1);
    });
    queryClient.setQueryData(["only-kept"], "what Finance was given");
    useSessionStore.getState().setExpired();

    await demoLogin("WAREHOUSE");

    await vi.waitFor(() => {
      expect(page.asked.times).toBe(2);
    });
    expect(queryClient.getQueryData(["only-kept"])).toBeUndefined();
    expect(useSessionStore.getState().session?.user.role).toBe("WAREHOUSE");
    page.stop();
  });

  it("keeps the page for the same person signing in again", async () => {
    stubAuth();
    useSessionStore.getState().setSession(sessionFor("FINANCE"));
    const page = onScreen("on-screen");
    await vi.waitFor(() => {
      expect(page.asked.times).toBe(1);
    });
    queryClient.setQueryData(["only-kept"], "what Finance was given");
    useSessionStore.getState().setExpired();

    await demoLogin("FINANCE");
    // Long enough for a reset to have asked again, had there been one.
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(page.asked.times).toBe(1);
    expect(queryClient.getQueryData(["only-kept"])).toBe(
      "what Finance was given",
    );
    expect(useSessionStore.getState().status).toBe("active");
    page.stop();
  });
});

describe("a sign-in while a session is open", () => {
  it("is left to the role menu, which resets once: the sign-in itself asks for nothing again", async () => {
    stubAuth();
    useSessionStore.getState().setSession(sessionFor("FINANCE"));
    const page = onScreen("on-screen");
    await vi.waitFor(() => {
      expect(page.asked.times).toBe(1);
    });

    await demoLogin("WAREHOUSE");
    await new Promise((resolve) => setTimeout(resolve, 50));

    // Twice would mean every list is asked for twice at each change of role.
    expect(page.asked.times).toBe(1);
    page.stop();
  });
});
