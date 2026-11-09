import { ROLE_LABELS, ROLES } from "@orderpilot/shared";
import type { Page } from "@playwright/test";
import { expect, expectRealPage, signInAs, test } from "../src/index.js";

// P-39: each role's menu holds only real pages. For every role this follows
// every menu entry and every place Ctrl+K offers, and checks that each lands
// on a real page. A menu entry added by a later story is covered with no edit
// here, because the entries are read from the page.

/** The address of every link in the sidebar, once each. */
async function menuAddresses(page: Page): Promise<string[]> {
  const nav = page.getByRole("navigation", { name: "Main navigation" });
  await expect(nav.getByRole("link").first()).toBeVisible();
  const hrefs = await nav
    .getByRole("link")
    .evaluateAll((links) =>
      links.map((link) => link.getAttribute("href") ?? ""),
    );
  return [...new Set(hrefs)];
}

async function openPalette(page: Page) {
  await page.goto("/");
  await expect(page.locator("main")).toBeVisible();
  await page.keyboard.press("Control+K");
  const places = page.getByRole("group", { name: "Go to" });
  await expect(places).toBeVisible();
  return places.getByRole("option");
}

for (const role of ROLES) {
  test(`${ROLE_LABELS[role]}: every menu entry and every Ctrl+K place opens a real page`, async ({
    page,
  }) => {
    test.setTimeout(180_000);
    await signInAs(page, role);
    await page.goto("/");
    const addresses = await menuAddresses(page);
    // Home and Settings at the least, for every role.
    expect(addresses).toContain("/");
    expect(addresses).toContain("/settings");

    for (const address of addresses) {
      await test.step(`menu: ${address}`, async () => {
        await page.goto(address);
        await expectRealPage(page, address);
      });
    }

    const paths = new Set(
      addresses.map((address) => new URL(address, "http://x").pathname),
    );
    const places = await openPalette(page);
    const count = await places.count();
    // Every entry of the menu is a place in the palette.
    expect(count).toBe(addresses.length);
    await page.keyboard.press("Escape");

    for (let index = 0; index < count; index += 1) {
      const option = (await openPalette(page)).nth(index);
      const name = (await option.innerText()).trim();
      await test.step(`palette: ${name}`, async () => {
        await option.click();
        await expectRealPage(page);
        // The palette goes where the menu goes, and nowhere else.
        expect(paths, `where "${name}" landed`).toContain(
          new URL(page.url()).pathname,
        );
      });
    }
  });
}

// A page that is not built has no address: it is the same not-found page as
// any unknown one, never a placeholder.
for (const path of [
  "/documents",
  "/mapping",
  "/connectors",
  "/constellation",
]) {
  test(`${path} is not found while it is not built`, async ({ page }) => {
    await signInAs(page, "SYSTEM_ADMIN");
    await page.goto(path);
    await expect(
      page.getByRole("heading", { name: "Page not found" }),
    ).toBeVisible();
  });
}
