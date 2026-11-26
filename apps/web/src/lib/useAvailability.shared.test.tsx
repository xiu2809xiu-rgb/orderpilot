import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { apiClient } from "@/lib/api/instance";
import { useSessionStore } from "@/stores/session";
import { errorBody, sessionFor } from "@/test/fixtures";
import { server } from "@/test/server";
import { useAvailability } from "./useAvailability";

// The Settings page draws two controls for one person: the side panel's dot
// and the profile card's ring. Each calls useAvailability, and the two must
// agree on what is saving and on what was refused.

const MINE = "*/api/v1/availability/mine";
const SET_AT = "2031-03-01T09:00:00.000Z";
const ENDS = "2031-03-01T21:00:00.000Z";
const free = { value: "AVAILABLE", setAt: null, expiresAt: null };

function wrapperFor(client: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
  };
}

function two(client = new QueryClient()) {
  return renderHook(
    () => ({ panel: useAvailability(), card: useAvailability() }),
    { wrapper: wrapperFor(client) },
  );
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

/** The PUTs are answered by `answer` in turn (a status, or 200); the reads show what the server holds. */
function serverAnswering(answers: number[], gate?: Promise<void>) {
  const puts: string[] = [];
  let held: object = free;
  server.use(
    http.get(MINE, () => HttpResponse.json({ data: held })),
    http.put(MINE, async ({ request }) => {
      const body = (await request.json()) as { value: string };
      puts.push(body.value);
      await gate;
      const status = answers[puts.length - 1] ?? 200;
      if (status !== 200) {
        return HttpResponse.json(errorBody("FORBIDDEN", "trace-shared-1"), {
          status,
        });
      }
      held = { value: body.value, setAt: SET_AT, expiresAt: ENDS };
      return HttpResponse.json({ data: held });
    }),
  );
  return puts;
}

async function ready(result: ReturnType<typeof two>["result"]) {
  await waitFor(() => {
    expect(result.current.panel.status).toBe("ready");
    expect(result.current.card.status).toBe("ready");
  });
}

describe("two controls for one person's availability", () => {
  it("drop a refusal when a later change succeeds from the other control, and Try again then sends nothing", async () => {
    const puts = serverAnswering([403, 200]);
    const { result } = two();
    await ready(result);
    act(() => {
      result.current.card.set("DO_NOT_DISTURB");
    });
    await waitFor(() => {
      expect(result.current.card.refused).not.toBeNull();
    });
    // Both controls know of it.
    expect(result.current.panel.refused).not.toBeNull();
    await waitFor(() => {
      expect(result.current.panel.saving).toBe(false);
    });
    act(() => {
      result.current.panel.set("FOCUSING");
    });
    await waitFor(() => {
      expect(result.current.card.value).toBe("FOCUSING");
      expect(result.current.card.saving).toBe(false);
    });
    expect(result.current.card.refused).toBeNull();
    expect(result.current.panel.refused).toBeNull();
    act(() => {
      result.current.card.retryLast();
    });
    expect(puts).toEqual(["DO_NOT_DISTURB", "FOCUSING"]);
  });

  it("send, on Try again, the change that was refused and is still the newest", async () => {
    const puts = serverAnswering([403, 200]);
    const { result } = two();
    await ready(result);
    act(() => {
      result.current.panel.set("DO_NOT_DISTURB");
    });
    await waitFor(() => {
      expect(result.current.card.refused).not.toBeNull();
    });
    await waitFor(() => {
      expect(result.current.card.saving).toBe(false);
    });
    act(() => {
      result.current.card.retryLast();
    });
    await waitFor(() => {
      expect(result.current.card.value).toBe("DO_NOT_DISTURB");
    });
    expect(puts).toEqual(["DO_NOT_DISTURB", "DO_NOT_DISTURB"]);
    expect(result.current.card.refused).toBeNull();
  });

  it("are both saving while either saves, and the second starts no second PUT", async () => {
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const puts = serverAnswering([], gate);
    const { result } = two();
    await ready(result);
    act(() => {
      result.current.card.set("FOCUSING");
    });
    await waitFor(() => {
      expect(result.current.panel.saving).toBe(true);
    });
    expect(result.current.card.saving).toBe(true);
    act(() => {
      result.current.panel.set("DO_NOT_DISTURB");
    });
    release();
    await waitFor(() => {
      expect(result.current.panel.saving).toBe(false);
      expect(result.current.card.saving).toBe(false);
    });
    expect(puts).toEqual(["FOCUSING"]);
    expect(result.current.panel.value).toBe("FOCUSING");
  });

  it("both play the pulse for a success from either", async () => {
    serverAnswering([]);
    const { result } = two();
    await ready(result);
    act(() => {
      result.current.card.set("FOCUSING");
    });
    await waitFor(() => {
      expect(result.current.panel.pulse).toBe(1);
    });
    expect(result.current.card.pulse).toBe(1);
  });

  it("do not show a refusal that came before a control appeared", async () => {
    serverAnswering([403]);
    const client = new QueryClient();
    const first = two(client);
    await ready(first.result);
    act(() => {
      first.result.current.panel.set("FOCUSING");
    });
    await waitFor(() => {
      expect(first.result.current.panel.refused).not.toBeNull();
    });
    await waitFor(() => {
      expect(first.result.current.panel.saving).toBe(false);
    });
    const later = two(client);
    await ready(later.result);
    expect(later.result.current.card.refused).toBeNull();
    expect(first.result.current.card.refused).not.toBeNull();
  });
});
