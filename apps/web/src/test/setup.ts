import "@testing-library/jest-dom/vitest";
import { cleanup, configure } from "@testing-library/react";
import { afterEach, beforeAll, vi } from "vitest";
import { i18nReady } from "@/i18n";

// Page tests time out under the full parallel run, so wait longer for async UI.
configure({ asyncUtilTimeout: 5_000 });

beforeAll(async () => {
  await i18nReady;
});

afterEach(() => {
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
