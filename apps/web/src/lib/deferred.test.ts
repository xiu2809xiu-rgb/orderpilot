import { afterEach, describe, expect, it, vi } from "vitest";
import { deferredModule, prefetch, whenIdle } from "./deferred";

describe("deferredModule", () => {
  it("fetches once however often it is asked", async () => {
    const importer = vi.fn(() => Promise.resolve({ name: "menu" }));
    const module = deferredModule(importer);
    expect(module.current()).toBeUndefined();
    await Promise.all([module.load(), module.load()]);
    await module.load();
    expect(importer).toHaveBeenCalledTimes(1);
    expect(module.current()).toEqual({ name: "menu" });
  });

  it("tells its subscribers when the module arrives", async () => {
    const module = deferredModule(() => Promise.resolve(1));
    const listener = vi.fn();
    const unsubscribe = module.subscribe(listener);
    await module.load();
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
  });

  it("tries again after a failed fetch, and a prefetch fails quietly", async () => {
    const importer = vi
      .fn<() => Promise<number>>()
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValue(2);
    const module = deferredModule(importer);
    prefetch(module);
    await expect(module.load()).rejects.toThrow("offline");
    await expect(module.load()).resolves.toBe(2);
    expect(importer).toHaveBeenCalledTimes(2);
  });
});

describe("whenIdle", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("uses requestIdleCallback where the browser has it, and can cancel", () => {
    const tasks: (() => void)[] = [];
    const cancel = vi.fn();
    vi.stubGlobal("requestIdleCallback", (task: () => void) =>
      tasks.push(task),
    );
    vi.stubGlobal("cancelIdleCallback", cancel);
    const task = vi.fn();
    const stop = whenIdle(task);
    expect(task).not.toHaveBeenCalled();
    tasks[0]?.();
    expect(task).toHaveBeenCalledTimes(1);
    stop();
    expect(cancel).toHaveBeenCalledWith(1);
  });

  it("falls back to a short timer, as in Safari", () => {
    const idle = Object.getOwnPropertyDescriptor(window, "requestIdleCallback");
    Reflect.deleteProperty(window, "requestIdleCallback");
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    try {
      const task = vi.fn();
      whenIdle(task);
      vi.advanceTimersByTime(250);
      expect(task).toHaveBeenCalledTimes(1);
      const later = vi.fn();
      whenIdle(later)();
      vi.advanceTimersByTime(250);
      expect(later).not.toHaveBeenCalled();
    } finally {
      if (idle) Object.defineProperty(window, "requestIdleCallback", idle);
    }
  });
});
