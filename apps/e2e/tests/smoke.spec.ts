import { request } from "@playwright/test";
import { authRoutes, COOKIES, ROLE_LABELS, ROLES } from "@orderpilot/shared";
import {
  apiUrl,
  checkPage,
  expect,
  signInAs,
  SMOKE_PAGES,
  test,
} from "../src/index.js";

// Every role signs in, opens its home page and its two main pages, and signs
// out. The pages come from SMOKE_PAGES, so a new page is one line there.
for (const role of ROLES) {
  test(`${ROLE_LABELS[role]}: home and main pages pass, and signing out ends the session`, async ({
    page,
  }) => {
    // A sign-in of its own: this test ends the session, and the other tests
    // keep using the stored one.
    await signInAs(page, role, { fresh: true });

    for (const { path, name } of SMOKE_PAGES[role]) {
      await test.step(name, async () => {
        await page.goto(path);
        // A role sent back to sign-in, or elsewhere, fails here.
        await expect(page).toHaveURL((url) => url.pathname === path);
        await checkPage(page);
      });
    }

    await test.step("Sign out", async () => {
      const before = await page.context().cookies();
      await page.getByRole("button", { name: "Account menu" }).click();
      await page.getByRole("menuitem", { name: "Sign out" }).click();
      await expect(page).toHaveURL((url) => url.pathname === "/login");
      const left = await page.context().cookies();
      expect(left.map(({ name }) => name)).not.toContain(COOKIES.access);

      // The cookies from before still reach the API, which must refuse them:
      // the session ended on the server, not only in this browser.
      const old = await request.newContext({
        storageState: { cookies: before, origins: [] },
      });
      try {
        const me = await old.get(apiUrl(authRoutes.me.path));
        expect(me.status(), "the old session after sign-out").toBe(401);
      } finally {
        await old.dispose();
      }
    });
  });
}

test("the sign-in page passes", async ({ page }) => {
  await page.goto("/login");
  await expect(
    page.getByRole("button", { name: ROLE_LABELS.SUPPORT }),
  ).toBeVisible();
  await checkPage(page);
});
