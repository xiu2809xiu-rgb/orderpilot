import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useSessionStore } from "@/stores/session";
import { errorBody, sessionFor } from "@/test/fixtures";
import { server } from "@/test/server";
import { myPictureKey, useMyPicture } from "./useMyPicture";

const MINE = "*/api/v1/profile-pictures/mine";
const PENDING_ID = "7c1d6f5e-3a52-4f7e-8f55-6c7b1c2b0a01";

const waiting = {
  approved: null,
  pending: {
    id: PENDING_ID,
    createdAt: "2026-11-24T10:00:00.000Z",
    ai: { status: "NOT_ALLOWED" },
  },
  notice: null,
  uploads: { used: 1, limit: 10 },
};

function wrapperFor(client: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
  };
}

function newClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

beforeEach(() => {
  useSessionStore.getState().setSession(sessionFor("SUPPORT"));
});

afterEach(() => {
  vi.useRealTimers();
});

describe("useMyPicture", () => {
  it("treats any failure as no picture and throws nothing", async () => {
    server.use(
      http.get(MINE, () =>
        HttpResponse.json(errorBody("INTERNAL_ERROR"), { status: 500 }),
      ),
    );
    const { result } = renderHook(() => useMyPicture(), {
      wrapper: wrapperFor(newClient()),
    });
    await waitFor(() => {
      expect(result.current.query.isError).toBe(true);
    });
    expect(result.current.picture).toBeUndefined();
  });

  it("keys the query by the signed-in person", async () => {
    server.use(
      http.get(MINE, () =>
        HttpResponse.json({
          data: { ...waiting, pending: null },
        }),
      ),
    );
    const client = newClient();
    const { result } = renderHook(() => useMyPicture(), {
      wrapper: wrapperFor(client),
    });
    await waitFor(() => {
      expect(result.current.picture).toBeDefined();
    });
    const userId = sessionFor("SUPPORT").user.id;
    expect(client.getQueryData(myPictureKey(userId))).toBeDefined();
    expect(myPictureKey("a")).not.toEqual(myPictureKey("b"));
  });

  it("asks again every 30 seconds while a picture waits and the card is watching", async () => {
    let asked = 0;
    server.use(
      http.get(MINE, () => {
        asked += 1;
        return HttpResponse.json({ data: waiting });
      }),
    );
    // Fake from the start: the timer is made when the first answer arrives.
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { result } = renderHook(() => useMyPicture({ watch: true }), {
      wrapper: wrapperFor(newClient()),
    });
    await waitFor(() => {
      expect(result.current.picture?.pending?.id).toBe(PENDING_ID);
    });
    expect(asked).toBe(1);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_500);
    });
    await waitFor(() => {
      expect(asked).toBe(2);
    });
  });

  it("does not ask again on a timer when nobody watches", async () => {
    let asked = 0;
    server.use(
      http.get(MINE, () => {
        asked += 1;
        return HttpResponse.json({ data: waiting });
      }),
    );
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { result } = renderHook(() => useMyPicture(), {
      wrapper: wrapperFor(newClient()),
    });
    await waitFor(() => {
      expect(result.current.picture).toBeDefined();
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(65_000);
    });
    expect(asked).toBe(1);
  });
});
