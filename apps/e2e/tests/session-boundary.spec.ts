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
