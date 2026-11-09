import {
  checkPage,
  expect,
  expectNoButton,
  expectRefused,
  signInAs,
  test,
} from "../src/index.js";

// P-36 and P-49: the Orders list. Support sees amounts and the one New order
// button, Warehouse sees dots with the reason and no button, the
// waiting-on-stock filter is one link away, nothing on the page orders
// anything, and the server refuses a role without orders.read (a screen that
// hides the list proves nothing). Creating an order is order-form.spec.ts.
// Specs that read rows open the samples: orders entered by other runs on a
// persistent stack sort first and have no four-digit number.

test.describe("The Orders list", () => {
  test("Support sees the orders with their amounts and the New order button", async ({
    page,
  }) => {
    await signInAs(page, "SUPPORT");
    await page.goto("/orders?source=sample");
    await expect(
      page.getByRole("heading", { level: 1, name: "Orders" }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: /^SO-\d{4}$/ }).first(),
    ).toBeVisible();
    await expect(page.getByText("Synthetic demo data").first()).toBeVisible();
    await expect(page.getByText(/USD\s?[\d,]+\.\d{2}/).first()).toBeVisible();
    await expect(page.getByRole("button", { name: "New order" })).toBeVisible();
    await expectNoButton(page, /order stock|raise|purchase/i);
  });

  test("Warehouse sees dots with the reason where the amounts would be, and no New order button", async ({
    page,
  }) => {
    await signInAs(page, "WAREHOUSE");
    await page.goto("/orders?source=sample");
    await expect(
      page.getByRole("link", { name: /^SO-\d{4}$/ }).first(),
    ).toBeVisible();
    await expect(page.getByText(/USD\s?[\d,]+\.\d{2}/)).toHaveCount(0);
    await expect(page.getByLabel(/hidden/i).first()).toBeVisible();
    await expectNoButton(page, "New order");
  });

  test("the waiting filter shows only orders short of stock, with how much", async ({
    page,
  }) => {
    await signInAs(page, "SUPPORT");
    await page.goto("/orders?stock=waiting");
    await expect(page.getByText(/^Short by /).first()).toBeVisible();
    await expect(page.getByText("No shortage")).toHaveCount(0);
  });

  test("fits at a desktop and a phone width with no accessibility violations", async ({
    page,
  }) => {
    await signInAs(page, "SUPPORT");
    await page.goto("/orders");
    await checkPage(page);
  });

  test("a role without orders.read is refused by the server", async () => {
    await expectRefused("SYSTEM_ADMIN", "GET", "/orders");
    await expectRefused("SYSTEM_ADMIN", "GET", "/orders/SO-0001");
  });
});
