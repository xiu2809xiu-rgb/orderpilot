import { defineConfig, devices } from "@playwright/test";
import { BASE_URL } from "./src/env.js";

const ci = process.env.CI === "true";

/**
 * The tests run against a stack that is already up: the compose stack on this
 * machine by default, or whatever E2E_BASE_URL names. They start nothing.
 *
 * Chromium only for now (ADR 0034). Firefox and WebKit are one project each
 * when a story needs them.
 */
export default defineConfig({
  testDir: "./tests",
  globalSetup: "./src/global-setup.ts",
  fullyParallel: true,
  forbidOnly: ci,
  // One retry on CI, which is also when a trace is kept: on Docker Desktop the
  // first load after a restart can stall, and a trace of every test is slow.
  retries: ci ? 1 : 0,
  ...(ci ? { workers: 2 } : {}),
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: ci
    ? [["list"], ["html", { open: "never" }], ["github"]]
    : [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    // axe misreads content that is still fading in, so motion is off.
    reducedMotion: "reduce",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 900 },
      },
    },
  ],
});
