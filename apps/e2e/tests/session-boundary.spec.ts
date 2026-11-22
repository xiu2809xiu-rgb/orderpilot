import { expect, signInAs, test } from "../src/index.js";

// The server masks by role. This holds the browser's half of that promise:
// what one person was shown must not be drawn for the next person who signs in
// at the same tab. Nothing here reloads the page after the sign-out, because a
// reload would empty the app's memory and hide the fault.

const VENDOR = "V-0007";
// The demo vendor's account number, shown to Finance only (synthetic data).
const ACCOUNT_NO = "000000000007";
const MASKED_REASON =
  "Bank details are hidden unless your role handles payments.";

test("after a sign-out, the next person at the same tab is not shown the earlier person's bank details", async ({
  page,
}) => {
  // A sign-in of its own: this test ends the session, and the other tests
  // keep using the stored one.
  await signInAs(page, "FINANCE", { fresh: true });
  await page.goto(`/master-data/vendors/${VENDOR}`);
  // Exact: the IBAN beside it ends in the same digits.
  await expect(page.getByText(ACCOUNT_NO, { exact: true })).toBeVisible();

  await test.step("Finance signs out", async () => {
    await page.getByRole("button", { name: "Account menu" }).click();
    await page.getByRole("menuitem", { name: "Sign out" }).click();
    await expect(page).toHaveURL((url) => url.pathname === "/login");
  });

  // From here on, every request for the vendor is one Warehouse made.
  const askedAsWarehouse: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes(`/master-data/vendors/${VENDOR}`)) {
      askedAsWarehouse.push(request.url());
    }
  });

  await test.step("Warehouse signs in on the sign-in page and opens the same vendor", async () => {
    await page.getByRole("button", { name: "Warehouse" }).click();
    await expect(page).toHaveURL((url) => url.pathname !== "/login");
    await page.getByRole("link", { name: "Vendors" }).click();
    await page.getByRole("link", { name: VENDOR }).click();
    await expect(
      page.getByRole("heading", { name: "Bank accounts" }),
    ).toBeVisible();
  });

  await expect(page.getByText(MASKED_REASON)).toBeVisible();
  // Not exact: neither the account number nor the IBAN that ends in it.
  await expect(page.getByText(ACCOUNT_NO)).toHaveCount(0);
  // The page was asked for as Warehouse, not drawn from what Finance was given.
  expect(askedAsWarehouse.length).toBeGreaterThan(0);
});

test("through the Demo role menu, the new person is never named over what the earlier person was shown", async ({
  page,
}) => {
  await signInAs(page, "FINANCE", { fresh: true });
  await page.goto("/");
  await page.getByRole("link", { name: "Vendors" }).click();
  await page.getByRole("link", { name: VENDOR }).click();
  await expect(page.getByText(ACCOUNT_NO, { exact: true })).toBeVisible();

  // Every moment the DOM holds the new person's name in the account menu while
  // the page's own text still holds the account number. A frame log would miss
  // a state that lasts less than a frame, a mutation observer does not.
  await page.evaluate((accountNo) => {
    const moments: string[] = [];
    Object.assign(window, { boundaryMoments: moments });
    const look = () => {
      const person = document.querySelector(".dx-person")?.textContent ?? "";
      const main = document.querySelector("main")?.textContent ?? "";
      if (person.includes("Hafiz Rahman") && main.includes(accountNo)) {
        moments.push(performance.now().toFixed(0));
      }
    };
    new MutationObserver(look).observe(document.body, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
    });
  }, ACCOUNT_NO);

  await test.step("Finance becomes Warehouse in the same tab, with no reload", async () => {
    await page.getByRole("button", { name: "Demo role" }).click();
    await page.getByRole("menuitem", { name: /Hafiz Rahman/ }).click();
    await expect(page.locator(".dx-person")).toContainText("Hafiz Rahman");
    // The change lands Home: a vendor's page is not kept for another role.
    await expect(page).toHaveURL((url) => url.pathname === "/");
    // The URL moves before the page does: wait for Home itself.
    await expect(
      page.getByRole("heading", {
        name: /Good (morning|afternoon|evening), Hafiz/,
      }),
    ).toBeVisible();
  });

  const moments = await page.evaluate(
    () => (window as unknown as { boundaryMoments: string[] }).boundaryMoments,
  );
  expect(moments).toEqual([]);

  await test.step("Warehouse opens the same vendor and is told the bank details are hidden", async () => {
    await page.getByRole("link", { name: "Vendors" }).click();
    await page.getByRole("link", { name: VENDOR }).click();
    await expect(
      page.getByRole("heading", { name: "Bank accounts" }),
    ).toBeVisible();
    await expect(page.getByText(MASKED_REASON)).toBeVisible();
    await expect(page.getByText(ACCOUNT_NO)).toHaveCount(0);
  });
});
