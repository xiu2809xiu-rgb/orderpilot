import { afterEach, describe, expect, it, vi } from "vitest";
import { withDeadline } from "./deadline.js";

describe("withDeadline", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns the value when the work finishes first", async () => {
    await expect(withDeadline(Promise.resolve(42), 1000)).resolves.toEqual({
      done: true,
      value: 42,
    });
  });

  it("says not done at the deadline", async () => {
    vi.useFakeTimers();
    const never = new Promise<number>(() => undefined);
    const result = withDeadline(never, 5000);
    await vi.advanceTimersByTimeAsync(5000);
    await expect(result).resolves.toEqual({ done: false });
  });

  it("clears its timer in both cases", async () => {
    vi.useFakeTimers();
    await withDeadline(Promise.resolve(1), 1000);
    expect(vi.getTimerCount()).toBe(0);
    const pending = withDeadline(new Promise<number>(() => undefined), 10);
    await vi.advanceTimersByTimeAsync(10);
    await pending;
    expect(vi.getTimerCount()).toBe(0);
  });

  it("swallows a rejection that comes after the deadline", async () => {
    vi.useFakeTimers();
    let fail: (reason: Error) => void = () => undefined;
    const work = new Promise<number>((_, reject) => {
      fail = reject;
    });
    const unhandled: unknown[] = [];
    const listener = (reason: unknown): void => {
      unhandled.push(reason);
    };
    process.on("unhandledRejection", listener);
    try {
      const result = withDeadline(work, 100);
      await vi.advanceTimersByTimeAsync(100);
      await expect(result).resolves.toEqual({ done: false });
      fail(new Error("late failure"));
      await vi.advanceTimersByTimeAsync(10);
      await Promise.resolve();
      expect(unhandled).toEqual([]);
    } finally {
      process.off("unhandledRejection", listener);
    }
  });

  it("passes on a failure that comes before the deadline", async () => {
    await expect(
      withDeadline(Promise.reject(new Error("provider down")), 1000),
    ).rejects.toThrow("provider down");
  });
});
