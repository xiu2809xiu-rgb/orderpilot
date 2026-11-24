import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { useToastStore } from "@/components/common/toast";
import { apiClient } from "@/lib/api/instance";
import { useSessionStore } from "@/stores/session";
import { errorBody, sessionFor } from "@/test/fixtures";
import { must } from "@/test/must";
import { server } from "@/test/server";
import { availabilityKey, useAvailability } from "./useAvailability";

const MINE = "*/api/v1/availability/mine";
const SET_AT = "2031-03-01T09:00:00.000Z";
const ENDS = "2031-03-01T21:00:00.000Z";

const focusing = { value: "FOCUSING", setAt: SET_AT, expiresAt: ENDS };
const dnd = { value: "DO_NOT_DISTURB", setAt: SET_AT, expiresAt: ENDS };
const free = { value: "AVAILABLE", setAt: null, expiresAt: null };

function newClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

function wrapperFor(client: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
  };
}

beforeEach(() => {
  useSessionStore.getState().setSession(sessionFor("SUPPORT"));
  document.cookie = "op_csrf=csrf-token-1";
  apiClient.markSessionStarted();
});

afterEach(() => {
  document.cookie = "op_csrf=; Max-Age=0";
  apiClient.reset();
});

/** The server holds one value; a PUT changes it and answers with it. */
function serverHolding(start: object, gate?: Promise<void>) {
  const seen: { csrf: string | null; body: unknown }[] = [];
  let held = start;
  server.use(
    http.get(MINE, () => HttpResponse.json({ data: held })),
    http.put(MINE, async ({ request }) => {
      const body = (await request.json()) as { value: string };
      await gate;
      seen.push({ csrf: request.headers.get("x-csrf-token"), body });
      held =
        body.value === "AVAILABLE"
          ? free
          : { value: body.value, setAt: SET_AT, expiresAt: ENDS };
      return HttpResponse.json({ data: held });
    }),
  );
  return seen;
}

function mount(client = newClient()) {
  return {
    client,
    ...renderHook(() => useAvailability(), { wrapper: wrapperFor(client) }),
  };
}

const toasts = () => useToastStore.getState().items;

describe("useAvailability", () => {
  it("is loading, then ready with the value and its end", async () => {
    serverHolding(dnd);
    const { result } = mount();
    expect(result.current.status).toBe("loading");
    expect(result.current.value).toBe("AVAILABLE");
    await waitFor(() => {
      expect(result.current.status).toBe("ready");
    });
    expect(result.current.value).toBe("DO_NOT_DISTURB");
    expect(result.current.expiresAt?.toISOString()).toBe(ENDS);
    expect(result.current.setAt?.toISOString()).toBe(SET_AT);
  });

  it("is an error when the route fails, with Available as the value shown", async () => {
    server.use(
      http.get(MINE, () =>
        HttpResponse.json(errorBody("INTERNAL_ERROR"), { status: 500 }),
      ),
    );
    const { result } = mount();
    await waitFor(() => {
      expect(result.current.status).toBe("error");
    });
    expect(result.current.value).toBe("AVAILABLE");
    expect(result.current.error).toBeTruthy();
  });

  it("keys the query by the signed-in person", async () => {
    serverHolding(free);
    const { client, result } = mount();
    await waitFor(() => {
      expect(result.current.status).toBe("ready");
    });
    const me = useSessionStore.getState().session?.user.id ?? "";
    expect(client.getQueryState(availabilityKey(me))?.status).toBe("success");
  });

  it("shows no earlier person's value to the next person", async () => {
    serverHolding(dnd);
    const client = newClient();
    const first = mount(client);
    await waitFor(() => {
      expect(first.result.current.value).toBe("DO_NOT_DISTURB");
    });
    first.unmount();
    act(() => {
      useSessionStore.getState().setSession(sessionFor("FINANCE"));
    });
    serverHolding(free);
    const second = mount(client);
    expect(second.result.current.status).toBe("loading");
    expect(second.result.current.value).toBe("AVAILABLE");
  });

  it("writes the answer at once, sends the PUT with the CSRF header and asks again", async () => {
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const seen = serverHolding(free, gate);
    const { client, result } = mount();
    await waitFor(() => {
      expect(result.current.status).toBe("ready");
    });
    let invalidated = 0;
    client.getQueryCache().subscribe((event) => {
      if (event.type === "updated" && event.action.type === "invalidate") {
        invalidated += 1;
      }
    });
    act(() => {
      result.current.set("FOCUSING");
    });
    // At once: the server is held back and has not answered.
    await waitFor(() => {
      expect(result.current.value).toBe("FOCUSING");
    });
    expect(result.current.saving).toBe(true);
    release();
    await waitFor(() => {
      expect(result.current.saving).toBe(false);
    });
    expect(seen).toEqual([
      { csrf: "csrf-token-1", body: { value: "FOCUSING" } },
    ]);
    expect(result.current.value).toBe("FOCUSING");
    expect(result.current.pulse).toBe(1);
    expect(invalidated).toBeGreaterThan(0);
  });

  it("does nothing for Available while Available", async () => {
    const seen = serverHolding(free);
    const { result } = mount();
    await waitFor(() => {
      expect(result.current.status).toBe("ready");
    });
    act(() => {
      result.current.set("AVAILABLE");
    });
    expect(result.current.saving).toBe(false);
    expect(seen).toHaveLength(0);
  });

  it("puts the previous value back on a refusal, keeps it, and says so with the trace id", async () => {
    server.use(
      http.get(MINE, () => HttpResponse.json({ data: focusing })),
      http.put(MINE, () =>
        HttpResponse.json(errorBody("FORBIDDEN", "trace-refused-1"), {
          status: 403,
        }),
      ),
    );
    const { result } = mount();
    await waitFor(() => {
      expect(result.current.value).toBe("FOCUSING");
    });
    act(() => {
      result.current.set("DO_NOT_DISTURB");
    });
    await waitFor(() => {
      expect(result.current.refused).not.toBeNull();
    });
    expect(result.current.value).toBe("FOCUSING");
    const failed = toasts().find((item) => item.kind === "error");
    expect(must(failed).message).toBe("Your availability was not changed");
    expect(must(failed).description).toContain("trace-refused-1");
    expect(failed?.undo).toBeUndefined();
  });

  it("offers Undo only after a change away from Available, and Undo sends Available", async () => {
    const seen = serverHolding(free);
    const { result } = mount();
    await waitFor(() => {
      expect(result.current.status).toBe("ready");
    });
    act(() => {
      result.current.set("DO_NOT_DISTURB");
    });
    await waitFor(() => {
      expect(toasts()).toHaveLength(1);
    });
    const undo = must(toasts()[0]?.undo);
    act(() => {
      void undo();
    });
    await waitFor(() => {
      expect(seen.map((call) => call.body)).toEqual([
        { value: "DO_NOT_DISTURB" },
        { value: "AVAILABLE" },
      ]);
    });
  });

  it("offers no Undo for a change away from Focusing, a repeat or a change to Available", async () => {
    serverHolding(focusing);
    const { result } = mount();
    await waitFor(() => {
      expect(result.current.value).toBe("FOCUSING");
    });
    for (const next of [
      "DO_NOT_DISTURB",
      "DO_NOT_DISTURB",
      "AVAILABLE",
    ] as const) {
      act(() => {
        result.current.set(next);
      });
      await waitFor(() => {
        expect(result.current.saving).toBe(false);
      });
    }
    const messages = toasts().map((item) => item.undo);
    expect(messages).toHaveLength(3);
    expect(messages.every((undo) => undo === undefined)).toBe(true);
  });

  it("sends a repeat of a live value, because it renews the 12 hours", async () => {
    const seen = serverHolding(dnd);
    const { result } = mount();
    await waitFor(() => {
      expect(result.current.value).toBe("DO_NOT_DISTURB");
    });
    act(() => {
      result.current.set("DO_NOT_DISTURB");
    });
    await waitFor(() => {
      expect(seen).toHaveLength(1);
    });
  });

  it("falls back at its end: it asks again, shows Available and says the page saw it", async () => {
    // The end is already past, so the timer's floor of one second is what is waited for.
    let held: object = {
      value: "FOCUSING",
      setAt: SET_AT,
      expiresAt: new Date(Date.now() - 1_000).toISOString(),
    };
    server.use(http.get(MINE, () => HttpResponse.json({ data: held })));
    const { result } = mount();
    await waitFor(() => {
      expect(result.current.value).toBe("FOCUSING");
    });
    held = free;
    expect(result.current.fellBack).toBe(false);
    await waitFor(
      () => {
        expect(result.current.value).toBe("AVAILABLE");
      },
      { timeout: 4_000 },
    );
    expect(result.current.fellBack).toBe(true);
  });
});
