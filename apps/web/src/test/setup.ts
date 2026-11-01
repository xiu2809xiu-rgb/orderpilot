import "@testing-library/jest-dom/vitest";
import { cleanup, configure } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, vi } from "vitest";
import { loadShellOverlays } from "@/app/shell/overlays/preload";
import i18n, { i18nReady } from "@/i18n";
import { server } from "./server";

// Page tests time out under the full parallel run, so wait longer for async UI.
configure({ asyncUtilTimeout: 5_000 });

// Tests that name no handler keep their own fetch stubs: bypass lets anything
// unhandled through, and a stub replaces the patched fetch anyway.
beforeAll(async () => {
  server.listen({ onUnhandledRequest: "bypass" });
  await i18nReady;
  // The common components read this namespace; load it so tests render at once.
  await i18n.loadNamespaces(["components", "gallery"]);
  // The shell's menus as they are once the browser has prefetched them.
  // overlays/deferred.test.tsx covers the moment before.
  await loadShellOverlays();
});

afterAll(() => {
  server.close();
});

afterEach(() => {
  server.resetHandlers();
  cleanup();
  vi.unstubAllGlobals();
});

// jsdom has no layout, matchMedia, ResizeObserver or scrollIntoView.
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    addListener: () => undefined,
    removeListener: () => undefined,
    dispatchEvent: () => false,
  }),
});

class ResizeObserverStub {
  observe() {
    // Nothing to observe in jsdom.
  }
  unobserve() {
    // Nothing to observe in jsdom.
  }
  disconnect() {
    // Nothing to observe in jsdom.
  }
}
window.ResizeObserver = ResizeObserverStub;
window.HTMLElement.prototype.scrollIntoView = () => undefined;
window.HTMLElement.prototype.hasPointerCapture = () => false;
window.HTMLElement.prototype.releasePointerCapture = () => undefined;
// axe asks for a canvas to measure some colours; jsdom has none.
HTMLCanvasElement.prototype.getContext = () => null;
