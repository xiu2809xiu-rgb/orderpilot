import { expect, type Page } from "@playwright/test";
import { takeProblems } from "./watch.js";

/** The headings of the pages that mean "you did not get what you asked for". */
const NOT_A_PAGE =
  /^(Page not found|You do not have access|Something went wrong)$/;

/** Less text than this in the main region means the page did not draw its content. */
const MIN_MAIN_TEXT = 40;

/**
 * Checks that the page a link or a menu landed on is a real one: the address
 * is the one asked for, the page is not the not-found, forbidden or crash
 * page, its main region has content, and nothing broke on the way (a console
 * error, a CSP violation, a 5xx, or a 403 from the API). It is lighter than
 * `checkPage` on purpose, so a test can follow every menu entry of a role.
 *
 * `path` is the route, such as "/governance"; a query is ignored, because a
 * list may rewrite its own filters.
 */
export async function expectRealPage(page: Page, path?: string): Promise<void> {
  if (path !== undefined) {
    const expected = new URL(path, "http://orderpilot.test").pathname;
    await expect(page).toHaveURL((url) => url.pathname === expected);
  }
  await page.waitForLoadState("networkidle");
  const main = page.locator("main");
  await expect(main).toBeVisible();
  await expect
    .poll(async () => (await main.innerText()).trim().length, {
      message: `the main region of ${page.url()} should fill with content`,
    })
    .toBeGreaterThanOrEqual(MIN_MAIN_TEXT);
  await expect(
    page.getByRole("heading", { name: NOT_A_PAGE }),
    `${page.url()} is an error page`,
  ).toHaveCount(0);
  expect(takeProblems(page), `problems on ${page.url()}`).toEqual([]);
}
