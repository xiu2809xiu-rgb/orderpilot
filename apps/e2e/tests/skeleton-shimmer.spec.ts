import type { Page } from "@playwright/test";
import { expect, signInAs, test } from "../src/index.js";

// Issue #426: a page or card skeleton shimmers, and is a still grey block under
// reduced motion. jsdom cannot run CSS, so the unit tests read the class and the
// style sheet (skeleton.test.tsx, motion.css.test.ts); this spec asks a real
// browser what it computes. playwright.config.ts runs every test with reduced
// motion on, so this spec switches it per check, as scroll-edges.spec.ts does.
//
// Home's "orders in each step" card loads from /api/v1/tracker/flow. The spec
// holds that one request back, so that the card's skeleton stays on screen
// while the computed style is read, and lets it go at the end.

interface Band {
  name: string;
  display: string;
  duration: string;
  timing: string;
  iterations: string;
}

/** What the browser computes for the band, the skeleton's ::after. */
function readBand(page: Page): Promise<Band> {
  return page.evaluate(() => {
    const host = document.querySelector('[data-slot="skeleton"].dx-shimmer');
    if (!host) throw new Error("no shimmering skeleton on the page");
    const band = getComputedStyle(host, "::after");
    return {
      name: band.animationName,
      display: band.display,
      duration: band.animationDuration,
      timing: band.animationTimingFunction,
      iterations: band.animationIterationCount,
    };
  });
}

test.describe("Skeleton shimmer", () => {
  test("sweeps a band at an even speed, and is still under reduced motion", async ({
    page,
  }) => {
    await signInAs(page, "SUPPORT");
    let release: () => void = () => undefined;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route("**/api/v1/tracker/flow*", async (route) => {
      await held;
      await route.continue();
    });
    try {
      await page.emulateMedia({ reducedMotion: "no-preference" });
      await page.goto("/");
      const skeleton = page.locator('[data-slot="skeleton"].dx-shimmer');
      await expect(skeleton.first()).toBeVisible();

      const moving = await readBand(page);
      expect(moving.name).toBe("dx-shimmer");
      expect(moving.display).toBe("block");
      expect(moving.timing).toBe("linear");
      expect(moving.iterations).toBe("infinite");
      expect(Number.parseFloat(moving.duration)).toBeGreaterThanOrEqual(1.4);
      expect(Number.parseFloat(moving.duration)).toBeLessThanOrEqual(1.8);

      // The band is removed, not frozen at the end of its one sweep.
      await page.emulateMedia({ reducedMotion: "reduce" });
      const still = await readBand(page);
      expect(still.name).toBe("none");
      expect(still.display).toBe("none");
    } finally {
      release();
    }
  });
});
