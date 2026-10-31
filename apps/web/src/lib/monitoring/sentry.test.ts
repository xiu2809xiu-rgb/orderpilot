import type * as SentryBrowser from "@sentry/browser";
import { describe, expect, it, vi } from "vitest";
import { initWebSentry, scrubBrowserEvent } from "./sentry";

describe("initWebSentry", () => {
  it("loads nothing and sends nothing without a DSN", async () => {
    const loader = vi.fn();
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    expect(await initWebSentry(undefined, { loader })).toBe(false);
    expect(await initWebSentry("", { loader })).toBe(false);
    expect(loader).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it("starts with errors only and every personal channel switched off when a DSN is set", async () => {
    const init = vi.fn();
    const fake = {
      init,
      globalHandlersIntegration: vi.fn(() => ({ name: "g" })),
      linkedErrorsIntegration: vi.fn(() => ({ name: "l" })),
      dedupeIntegration: vi.fn(() => ({ name: "d" })),
    } as unknown as typeof SentryBrowser;
    const started = await initWebSentry("https://key@sentry.example/1", {
      loader: () => Promise.resolve(fake),
    });
    expect(started).toBe(true);
    const options = init.mock.calls[0]?.[0] as {
      defaultIntegrations: boolean;
      tracesSampleRate: number;
      dataCollection: unknown;
    };
    expect(options.defaultIntegrations).toBe(false);
    expect(options.tracesSampleRate).toBe(0);
    expect(options.dataCollection).toEqual({
      userInfo: false,
      cookies: false,
      httpHeaders: false,
      httpBodies: [],
      urlQueryParams: false,
    });
  });
});

describe("scrubBrowserEvent", () => {
  it("removes cookies, headers, body, query string and user", () => {
    const event = {
      request: {
        url: "https://app.example/orders/1?token=abc#x",
        cookies: { session: "s" },
        headers: { Authorization: "Bearer t" },
        data: { email: "a@b.c" },
      },
      user: { id: "u1", email: "a@b.c" },
    } as unknown as SentryBrowser.ErrorEvent;
    const out = scrubBrowserEvent(event);
    expect(out.request).toEqual({ url: "https://app.example/orders/1" });
    expect(out.user).toBeUndefined();
  });
});
