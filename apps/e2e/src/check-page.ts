import AxeBuilder from "@axe-core/playwright";
import { expect, type Page } from "@playwright/test";
import { takeProblems } from "./watch.js";

/** The two sizes every page must fit without scrolling sideways. */
export const SIZES = [
  { width: 1440, height: 900 },
  { width: 390, height: 844 },
] as const;

/** WCAG 2.2 AA, as axe tags it: every level A and AA rule up to 2.2. */
export const WCAG_TAGS = [
  "wcag2a",
  "wcag2aa",
  "wcag21a",
  "wcag21aa",
  "wcag22aa",
];

/** Text written for developers, which a person should never read on a screen. */
const DEVELOPER_TEXT: readonly (readonly [RegExp, string])[] = [
  [/\bPlanned\b/, 'the word "Planned"'],
  [/Counts appear/i, "a placeholder subtitle"],
  [/coming soon|lorem ipsum|john doe/i, "placeholder text"],
  [/\b(TODO|FIXME)\b|it\.todo/, "a note to developers"],
  [/\bundefined\b|\bNaN\b|\[object Object\]/, "a broken value"],
  // Built from its code point, so this file holds no em dash itself.
  [new RegExp(String.fromCodePoint(0x2014)), "an em dash"],
];

/** A page with less text than this in its main region did not load its content. */
const MIN_MAIN_TEXT = 120;

/** Waits until the page has loaded its data and drawn its content. */
async function settle(page: Page): Promise<void> {
  await page.waitForLoadState("networkidle");
  const main = page.locator("main").or(page.locator("body")).first();
  await expect(main).toBeVisible();
  await expect
    .poll(async () => (await main.innerText()).trim().length, {
      message: "the page's main region should fill with content",
    })
    .toBeGreaterThanOrEqual(MIN_MAIN_TEXT);
}

/** Leaf text that is a translation key, such as "userMenu.signOut" or "audit:title". */
function rawKeys(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const key = /^[a-z][a-zA-Z0-9]*(?:[.:][a-zA-Z0-9]+)+$/;
    const found: string[] = [];
    for (const el of document.body.querySelectorAll("*")) {
      if (el.children.length > 0 || el.closest("code,kbd,pre")) continue;
      const text = el.textContent.trim();
      // A key has a namespace colon or a camelCase part; "orders.read" is a name.
      if (key.test(text) && /[:A-Z]/.test(text)) found.push(text);
    }
    return found;
  });
}

async function sidewaysScroll(page: Page): Promise<number | null> {
  const { scrollWidth, innerWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
  }));
  return scrollWidth > innerWidth + 1 ? scrollWidth : null;
}

async function axeProblems(page: Page): Promise<string[]> {
  const { violations } = await new AxeBuilder({ page })
    .withTags(WCAG_TAGS)
    .analyze();
  return violations.map(
    ({ id, impact, help, nodes }) =>
      `axe ${id} (${impact ?? "unknown"}): ${help}, at ${nodes
        .slice(0, 3)
        .map((node) => node.target.join(" "))
        .join("; ")}`,
  );
}

/**
 * What the walk fails a page on, as one assertion: no console error, no CSP
 * violation, no response of 500 or more (or a 403 from the API), no text
 * addressed to developers, no sideways scroll at 1440 by 900 or at 390 by
 * 844, and no axe violation of WCAG 2.2 AA at either size. Every problem is
 * listed in the failure, not only the first.
 *
 * Call it after `page.goto`. It waits for the page to settle first, and puts
 * the viewport back as it was.
 */
export async function checkPage(page: Page): Promise<void> {
  await settle(page);
  const problems: string[] = [];
  const body = await page.locator("body").innerText();
  for (const [pattern, what] of DEVELOPER_TEXT) {
    const match = pattern.exec(body);
    if (match) problems.push(`${what} on the page: "${match[0]}"`);
  }
  for (const key of await rawKeys(page)) {
    problems.push(`a translation key on the page: "${key}"`);
  }

  const original = page.viewportSize();
  try {
    for (const size of SIZES) {
      await page.setViewportSize(size);
      // Two frames, so the layout has answered the new width.
      await page.evaluate(
        () =>
          new Promise((resolve) =>
            requestAnimationFrame(() => requestAnimationFrame(resolve)),
          ),
      );
      const at = `at ${String(size.width)} by ${String(size.height)}`;
      const scrollWidth = await sidewaysScroll(page);
      if (scrollWidth !== null) {
        problems.push(
          `the page scrolls sideways ${at} (${String(scrollWidth)}px wide)`,
        );
      }
      for (const problem of await axeProblems(page)) {
        problems.push(`${problem} ${at}`);
      }
    }
  } finally {
    if (original) await page.setViewportSize(original);
  }

  problems.push(...takeProblems(page));
  expect(problems, `checkPage found problems on ${page.url()}`).toEqual([]);
}
