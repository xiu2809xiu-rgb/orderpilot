import { test as base } from "@playwright/test";
import { CSP_BINDING, watchPage } from "./watch.js";

/** The web app's key for the analytics choice (apps/web, AnalyticsTracker). */
const CONSENT_KEY = "op.analytics.consent";

export interface E2eOptions {
  /**
   * The analytics choice the browser already holds when a page loads.
   * "denied" by default, as a returning person would have answered the card.
   * Only a test of the card itself sets "unset".
   */
  readonly consent: "denied" | "granted" | "unset";
}

/**
 * Playwright's `test`, with every page watched for problems and the
 * analytics card already answered. Every spec imports `test` and `expect`
 * from here.
 */
export const test = base.extend<E2eOptions>({
  consent: ["denied", { option: true }],
  page: async ({ page, consent }, use) => {
    await watchPage(page);
    await page.addInitScript(
      ({ binding, key, choice }) => {
        document.addEventListener("securitypolicyviolation", (event) => {
          const report = (
            window as unknown as Partial<
              Record<string, (text: string) => Promise<void>>
            >
          )[binding];
          void report?.(
            `${event.violatedDirective} blocked ${event.blockedURI}`,
          );
        });
        if (choice === "unset") return;
        try {
          // Only when nothing is stored: a choice made in the test stands.
          if (localStorage.getItem(key) === null) {
            localStorage.setItem(key, choice);
          }
        } catch {
          // Storage is blocked: the card shows, as it would for a person.
        }
      },
      { binding: CSP_BINDING, key: CONSENT_KEY, choice: consent },
    );
    await use(page);
  },
});

export { expect } from "@playwright/test";
