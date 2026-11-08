import {
  checkPage,
  expect,
  expectNoButton,
  expectRefused,
  signInAs,
  test,
} from "../src/index.js";

// P-36: the Orders list. Support sees amounts and Warehouse sees dots with the
// reason, the waiting-on-stock filter is one link away, nothing on the page
// creates or orders anything, and the server refuses a role without
// orders.read (a screen that hides the list proves nothing).

test.describe("The Orders list", () => {
  test("Support sees the orders with their amounts and no New button", async ({
    page,
  }) => {
    await signInAs(page, "SUPPORT");
    await page.goto("/orders");
    await expect(
      page.getByRole("heading", { level: 1, name: "Orders" }),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "SO-0001" })).toBeVisible();
    await expect(page.getByText("Synthetic demo data").first()).toBeVisible();
    await expect(page.getByText(/USD\s?[\d,]+\.\d{2}/).first()).toBeVisible();
    await expectNoButton(page, /^New/);
    await expectNoButton(page, /order stock|raise|purchase/i);
  });

  test("Warehouse sees dots with the reason where the amounts would be", async ({
    page,
  }) => {
    await signInAs(page, "WAREHOUSE");
    await page.goto("/orders");
    await expect(page.getByRole("link", { name: "SO-0001" })).toBeVisible();
    await expect(page.getByText(/USD\s?[\d,]+\.\d{2}/)).toHaveCount(0);
    await expect(page.getByLabel(/hidden/i).first()).toBeVisible();
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
