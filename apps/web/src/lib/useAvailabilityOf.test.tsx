import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it } from "vitest";
import { useSessionStore } from "@/stores/session";
import { errorBody, sessionFor } from "@/test/fixtures";
import { server } from "@/test/server";
import { useAvailabilityOf } from "./useAvailabilityOf";

const LOOKUP = "*/api/v1/availability";

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

const idOf = (n: number) =>
  `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

beforeEach(() => {
  useSessionStore.getState().setSession(sessionFor("SUPPORT"));
});

/** Answers each asked id as Available, and records the ids of every request. */
function answering() {
  const asked: string[][] = [];
  server.use(
    http.get(LOOKUP, ({ request }) => {
      const ids = (new URL(request.url).searchParams.get("ids") ?? "").split(
        ",",
      );
      asked.push(ids);
      return HttpResponse.json({
        data: ids.map((userId) => ({
          userId,
          value: userId === idOf(2) ? "DO_NOT_DISTURB" : "AVAILABLE",
          setAt: null,
        })),
      });
    }),
  );
  return asked;
}

describe("useAvailabilityOf", () => {
  it("sends one request with the ids joined by commas and maps the answer by id", async () => {
    const asked = answering();
    const { result } = renderHook(() => useAvailabilityOf([idOf(1), idOf(2)]), {
      wrapper,
    });
    await waitFor(() => {
      expect(result.current.byId.size).toBe(2);
    });
    expect(asked).toEqual([[idOf(1), idOf(2)]]);
    expect(result.current.byId.get(idOf(2))?.value).toBe("DO_NOT_DISTURB");
  });

  it("splits 250 ids into three requests of at most 100", async () => {
    const asked = answering();
    const ids = Array.from({ length: 250 }, (_, i) => idOf(i + 1));
    const { result } = renderHook(() => useAvailabilityOf(ids), { wrapper });
    await waitFor(() => {
      expect(result.current.byId.size).toBe(250);
    });
    expect(asked.map((group) => group.length).sort((a, b) => b - a)).toEqual([
      100, 100, 50,
    ]);
  });

  it("sends nothing for no ids, or when it is not enabled", async () => {
    const asked = answering();
    renderHook(() => useAvailabilityOf([]), { wrapper });
    renderHook(() => useAvailabilityOf([idOf(1)], { enabled: false }), {
      wrapper,
    });
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(asked).toHaveLength(0);
  });

  it("leaves byId empty when the request fails", async () => {
    server.use(
      http.get(LOOKUP, () =>
        HttpResponse.json(errorBody("INTERNAL_ERROR"), { status: 500 }),
      ),
    );
    const { result } = renderHook(() => useAvailabilityOf([idOf(1)]), {
      wrapper,
    });
    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
    expect(result.current.byId.size).toBe(0);
  });
});
