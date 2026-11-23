import type { Page } from "@playwright/test";
import { expect, signInAs, test } from "../src/index.js";

// The page rhythm (docs/design/design-system.md): the head of a page binds to
// the block under it at one gap, 24 px, whatever the page. A unit test reads
// the source, but only a browser shows which rule wins: an unlayered margin on
// a page's head once beat the stack rule and left 16, 40 or 48 px on most
// pages. Orders is the page with its own head rules (orders.css); Audit is a
// plain page on the stack.

const HEAD_GAP = 24;

/** From the bottom of the page head to the top of the first block below it, or null while the page is still drawing. */
async function headGap(page: Page): Promise<number | null> {
  return page.evaluate(() => {
    const head = document.querySelector("main h1")?.closest(".dx-page-head");
    if (!head) return null;
    const shown = (el: Element) => {
      const box = el.getBoundingClientRect();
      return box.width > 0 && box.height > 0;
    };
    let next = head.nextElementSibling;
    while (next && !shown(next)) next = next.nextElementSibling;
    if (!next) return null;
    return (
      next.getBoundingClientRect().top - head.getBoundingClientRect().bottom
    );
  });
}

test.describe("The page rhythm", () => {
  for (const { role, path, title } of [
    { role: "SUPPORT", path: "/orders?source=sample", title: "Orders" },
    { role: "AUDITOR", path: "/audit", title: "Audit log" },
  ] as const) {
    test(`${title}: the head is ${String(HEAD_GAP)} px above the first block below it`, async ({
      page,
    }) => {
      await signInAs(page, role);
      await page.goto(path);
      await expect(
        page.getByRole("heading", { level: 1, name: title }),
      ).toBeVisible();
      // Polled: the head is drawn before the block under it on a slow load.
      await expect
        .poll(async () => {
          const gap = await headGap(page);
          return gap === null ? Infinity : Math.abs(gap - HEAD_GAP);
        })
        .toBeLessThanOrEqual(1);
    });
  }
});
