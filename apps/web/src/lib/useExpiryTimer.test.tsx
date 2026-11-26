import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useExpiryTimer } from "./useExpiryTimer";

const NOW = new Date("2031-03-01T09:00:00.000Z");
const at = (ms: number) => new Date(NOW.getTime() + ms).toISOString();

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("useExpiryTimer", () => {
  it("asks once, 250 ms after the end, and stops when the server says it ended", async () => {
    const ask = vi.fn(() => Promise.resolve<string | null>(null));
    renderHook(() => {
      useExpiryTimer(at(5_000), ask);
    });
    await vi.advanceTimersByTimeAsync(5_249);
    expect(ask).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(ask).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(600_000);
    expect(ask).toHaveBeenCalledTimes(1);
  });

  it("never waits longer than a day, even for an end years away", async () => {
    const ask = vi.fn(() => Promise.resolve<string | null>(null));
    renderHook(() => {
      useExpiryTimer(at(5 * 365 * 24 * 3_600_000), ask);
    });
    await vi.advanceTimersByTimeAsync(24 * 3_600_000 - 1);
    expect(ask).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(ask).toHaveBeenCalledTimes(1);
  });

  it("never asks sooner than one second, even for an end in the past", async () => {
    const ask = vi.fn(() => Promise.resolve<string | null>(null));
    renderHook(() => {
      useExpiryTimer(at(-3_600_000), ask);
    });
    await vi.advanceTimersByTimeAsync(999);
    expect(ask).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(ask).toHaveBeenCalledTimes(1);
  });

  it("waits 30 s, then 60 s, doubling to a ceiling of 5 minutes, while the server says it is still live", async () => {
    const end = at(0);
    const ask = vi.fn(() => Promise.resolve<string | null>(end));
    renderHook(() => {
      useExpiryTimer(end, ask);
    });
    const gaps: number[] = [];
    let last = 0;
    ask.mockImplementation(() => {
      gaps.push(Date.now() - last);
      last = Date.now();
      return Promise.resolve(end);
    });
    last = Date.now();
    await vi.advanceTimersByTimeAsync(1_000);
    await vi.advanceTimersByTimeAsync(30_000);
    await vi.advanceTimersByTimeAsync(60_000);
    await vi.advanceTimersByTimeAsync(120_000);
    await vi.advanceTimersByTimeAsync(240_000);
    await vi.advanceTimersByTimeAsync(300_000);
    await vi.advanceTimersByTimeAsync(300_000);
    expect(gaps).toEqual([
      1_000, 30_000, 60_000, 120_000, 240_000, 300_000, 300_000,
    ]);
  });

  it("makes at most 5 requests in 10 minutes when the browser clock is an hour ahead", async () => {
    // The browser thinks the end was an hour ago; the server still names it.
    const end = at(-3_600_000);
    const ask = vi.fn(() => Promise.resolve<string | null>(end));
    renderHook(() => {
      useExpiryTimer(end, ask);
    });
    await vi.advanceTimersByTimeAsync(600_000);
    expect(ask.mock.calls.length).toBeLessThanOrEqual(5);
    expect(ask.mock.calls.length).toBeGreaterThan(1);
  });

  it("is cleared when the component goes away", async () => {
    const ask = vi.fn(() => Promise.resolve<string | null>(null));
    const { unmount } = renderHook(() => {
      useExpiryTimer(at(5_000), ask);
    });
    unmount();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(ask).not.toHaveBeenCalled();
  });

  it("starts again for a new end", async () => {
    const ask = vi.fn(() => Promise.resolve<string | null>(null));
    const { rerender } = renderHook(
      ({ end }: { end: string }) => {
        useExpiryTimer(end, ask);
      },
      { initialProps: { end: at(5_000) } },
    );
    rerender({ end: at(20_000) });
    await vi.advanceTimersByTimeAsync(10_000);
    expect(ask).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(10_250);
    expect(ask).toHaveBeenCalledTimes(1);
  });
});
