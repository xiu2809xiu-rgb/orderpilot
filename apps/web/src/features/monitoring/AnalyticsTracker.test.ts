import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  AnalyticsTracker,
  CONSENT_STORAGE_KEY,
  readPrivacySignals,
  routePattern,
  type AnalyticsTrackerOptions,
} from "./AnalyticsTracker";

function makeStorage(initial?: string) {
  const values = new Map<string, string>();
  if (initial !== undefined) values.set(CONSENT_STORAGE_KEY, initial);
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => void values.set(key, value),
    removeItem: (key: string) => void values.delete(key),
  };
}

function setup(options: Partial<AnalyticsTrackerOptions> = {}) {
  const send = vi.fn<AnalyticsTrackerOptions["send"]>(() =>
    Promise.resolve(undefined),
  );
  const tracker = new AnalyticsTracker({
    send,
    storage: makeStorage(),
    now: () => new Date("2026-11-01T10:00:00.000Z"),
    ...options,
  });
  return { tracker, send };
}

describe("AnalyticsTracker", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("records nothing before the person chooses", async () => {
    const { tracker, send } = setup();
    tracker.track("page_view", "/orders");
    await tracker.flush();
    expect(tracker.consent).toBe("unset");
    expect(tracker.pending).toBe(0);
    expect(send).not.toHaveBeenCalled();
  });

  it("sends a page view as a name, a route pattern and a time once consent is given", async () => {
    const { tracker, send } = setup();
    tracker.grant();
    tracker.track("page_view", "/orders/:id");
    await tracker.flush();
    expect(send).toHaveBeenCalledExactlyOnceWith({
      events: [
        {
          name: "page_view",
          route: "/orders/:id",
          at: "2026-11-01T10:00:00.000Z",
        },
      ],
    });
  });

  it("batches events and sends when the batch is full", () => {
    const { tracker, send } = setup({ batchSize: 3 });
    tracker.grant();
    tracker.track("page_view", "/a");
    tracker.track("page_view", "/b");
    expect(send).not.toHaveBeenCalled();
    tracker.track("page_view", "/c");
    expect(send).toHaveBeenCalledOnce();
    expect(send.mock.calls[0]?.[0].events).toHaveLength(3);
  });

  it("sends a waiting batch after the delay", async () => {
    const { tracker, send } = setup({ flushAfterMs: 1_000 });
    tracker.grant();
    tracker.track("page_view", "/a");
    await vi.advanceTimersByTimeAsync(1_000);
    expect(send).toHaveBeenCalledOnce();
  });

  it("throws waiting events away when consent is withdrawn", async () => {
    const { tracker, send } = setup();
    tracker.grant();
    tracker.track("page_view", "/a");
    tracker.deny();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(tracker.pending).toBe(0);
    expect(send).not.toHaveBeenCalled();
  });

  it.each([
    ["Do Not Track", { doNotTrack: "1" }],
    ["Global Privacy Control", { globalPrivacyControl: true }],
  ])("%s overrides a stored yes", async (_name, signals) => {
    const { tracker, send } = setup({
      storage: makeStorage("granted"),
      signals,
    });
    expect(tracker.consent).toBe("blocked");
    tracker.grant();
    tracker.track("page_view", "/a");
    await tracker.flush();
    expect(tracker.consent).toBe("blocked");
    expect(send).not.toHaveBeenCalled();
  });

  it("remembers the choice in storage, and survives storage that throws", () => {
    const storage = makeStorage();
    const first = setup({ storage }).tracker;
    first.grant();
    expect(setup({ storage }).tracker.consent).toBe("granted");

    const broken = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
      removeItem: () => undefined,
    };
    const { tracker } = setup({ storage: broken });
    expect(tracker.consent).toBe("unset");
    tracker.grant();
    expect(tracker.consent).toBe("granted");
  });

  it("drops a batch whose send fails instead of retrying", async () => {
    const { tracker, send } = setup();
    send.mockRejectedValueOnce(new Error("offline"));
    tracker.grant();
    tracker.track("page_view", "/a");
    await expect(tracker.flush()).resolves.toBeUndefined();
    expect(tracker.pending).toBe(0);
    await tracker.flush();
    expect(send).toHaveBeenCalledOnce();
  });

  it("never puts a user id or any other field in an event", async () => {
    const { tracker, send } = setup();
    tracker.grant();
    tracker.track("page_view", "/orders");
    await tracker.flush();
    expect(Object.keys(send.mock.calls[0]?.[0].events[0] ?? {}).sort()).toEqual(
      ["at", "name", "route"],
    );
  });
});

describe("readPrivacySignals", () => {
  it("reads both browser signals", () => {
    expect(
      readPrivacySignals({
        doNotTrack: "1",
        globalPrivacyControl: true,
      } as unknown as Navigator),
    ).toEqual({ doNotTrack: "1", globalPrivacyControl: true });
  });
});

describe("routePattern", () => {
  it("turns matched params into names", () => {
    expect(routePattern("/orders/8f2a-91", { id: "8f2a-91" })).toBe(
      "/orders/:id",
    );
  });

  it("never lets a raw id through, even one the router did not name", () => {
    expect(routePattern("/orders/12345/lines/ab12", {})).toBe(
      "/orders/:value/lines/:value",
    );
  });

  it("keeps plain words and the root", () => {
    expect(routePattern("/governance", {})).toBe("/governance");
    expect(routePattern("/", {})).toBe("/");
  });
});
