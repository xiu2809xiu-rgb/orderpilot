import { render } from "@testing-library/react";
import { beforeAll, vi } from "vitest";
import { App } from "@/app/App";
import { createTestRouter } from "@/app/router";
import { loadShellOverlays } from "@/app/shell/overlays/preload";
import { resetBootstrap } from "@/lib/api/auth";
import { apiClient } from "@/lib/api/instance";
import { queryClient } from "@/lib/query";
import { useRecordTabs } from "@/stores/recordTabs";
import { useSessionStore } from "@/stores/session";
import { mockApi, type MockApiState } from "./fixtures";

// A file that renders the app sees the shell's menus as they are once the
// browser has prefetched them (overlays/deferred.test.tsx covers the moment
// before). Only these files pay for loading Radix, not every test file.
beforeAll(loadShellOverlays);

/** Puts the app, the stores and the cookie back to a fresh page load. */
export function resetApp() {
  resetBootstrap();
  queryClient.clear();
  useSessionStore.setState({ status: "booting", session: null });
  useRecordTabs.setState({ owner: null, tabs: [] });
  apiClient.reset();
  document.cookie = "op_csrf=; Max-Age=0";
  document.documentElement.classList.remove("dark");
  localStorage.clear();
}

/**
 * Renders the whole app at `path` against the fake API. With a `session`, the
 * page load looks like a reload with a session cookie, so `/auth/me` answers.
 */
export function renderApp(path: string, api: Partial<MockApiState> = {}) {
  resetApp();
  const mock = mockApi(api);
  vi.stubGlobal("fetch", mock.fetch);
  if (api.session) {
    document.cookie = "op_csrf=csrf-token-1";
    apiClient.markSessionStarted();
  }
  const router = createTestRouter([path]);
  return { ...mock, router, ...render(<App router={router} />) };
}
