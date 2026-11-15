import {
  checkPage,
  expect,
  expectNoButton,
  expectRefused,
  signInAs,
  test,
} from "../src/index.js";

// P-36, P-49 and P-107: the Orders workspace and the order page. Support sees
// amounts and the one New order button, Warehouse sees dots with the reason
// and no button, the waiting-on-stock filter says what each order is short of,
// nothing on the page orders anything, an old link still opens the same list,
// and the server refuses a role without orders.read (a screen that hides the
// list proves nothing). Creating an order is order-form.spec.ts; the grid's
// ticks, menu and Print are list-grid.spec.ts.
// Specs that read rows open the samples: orders entered by other runs on a
// persistent stack sort first and have no four-digit number.

const SAMPLE_LINK = /^SO-\d{4}$/;

test.describe("The Orders workspace", () => {
  test("Support sees the orders with their amounts and the New order button", async ({
    page,
  }) => {
    await signInAs(page, "SUPPORT");
    await page.goto("/orders?source=sample");
    await expect(
      page.getByRole("heading", { level: 1, name: "Orders" }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: SAMPLE_LINK }).first(),
    ).toBeVisible();
    await expect(page.getByText("Synthetic demo data").first()).toBeVisible();
    await expect(page.getByText(/USD\s?[\d,]+\.\d{2}/).first()).toBeVisible();
    await expect(page.getByRole("link", { name: "New order" })).toBeVisible();
    await expectNoButton(page, /order stock|raise|purchase/i);
    await expect(
      page.getByRole("link", { name: /order stock|raise|purchase/i }),
    ).toHaveCount(0);
  });

  test("Warehouse sees dots with the reason where the amounts would be, and no New order button", async ({
    page,
  }) => {
    await signInAs(page, "WAREHOUSE");
    await page.goto("/orders?source=sample");
    await expect(
      page.getByRole("link", { name: SAMPLE_LINK }).first(),
    ).toBeVisible();
    await expect(page.getByText(/USD\s?[\d,]+\.\d{2}/)).toHaveCount(0);
    const mask = page.getByRole("button", { name: /hidden/i }).first();
    await expect(mask).toBeVisible();
    await expect(mask).toHaveAccessibleDescription(
      /prices are for roles that work with pricing/,
    );
    await expect(page.getByRole("link", { name: "New order" })).toHaveCount(0);
    await expectNoButton(page, "New order");
    // The amount cannot be sorted: the order of hidden figures would give them away.
    await expect(
      page.getByRole("columnheader", { name: "Value" }).getByRole("button"),
    ).toHaveCount(0);
  });

  test("the waiting filter shows only orders short of stock, with how much and of what", async ({
    page,
  }) => {
    await signInAs(page, "SUPPORT");
    await page.goto("/orders?stock=waiting");
    await expect(
      page
        .getByRole("list", { name: "Filters in force" })
        .getByText("Waiting on stock"),
    ).toBeVisible();
    // The switch is under More filters, and it is on.
    await page.getByRole("button", { name: /More filters/ }).click();
    await expect(
      page.getByRole("switch", { name: "Waiting on stock" }),
    ).toBeChecked();
    await page.keyboard.press("Escape");
    await expect(page.getByText(/^Short [\d,.]+$/).first()).toBeVisible();
    // The Stock column says Covered for an order that is not short of anything.
    await expect(page.getByText("Covered")).toHaveCount(0);
  });

  test("an address the old Orders list made still opens the same list", async ({
    page,
  }) => {
    await signInAs(page, "SUPPORT");
    await page.goto(
      "/orders?source=sample&customerNo=C-0001&orderDateFrom=2000-01-01&direction=desc&sort=orderNo",
    );
    const filters = page.getByRole("list", { name: "Filters in force" });
    await expect(filters.getByText(/^Customer: /)).toBeVisible();
    await expect(filters.getByText("Source: Sample")).toBeVisible();
    await expect(
      page.getByRole("link", { name: SAMPLE_LINK }).first(),
    ).toBeVisible();
    // Every row is that customer's: the number is shown beside the name.
    const customers = page.getByRole("cell").filter({ hasText: /^.+C-\d{4}$/ });
    expect(await customers.count()).toBeGreaterThan(0);
    for (const text of await customers.allInnerTexts()) {
      expect(text).toContain("C-0001");
    }
  });

  test("a click on a row opens the side peek, and the number opens the order", async ({
    page,
  }) => {
    await signInAs(page, "SUPPORT");
    await page.goto("/orders?source=sample");
    const first = page.getByRole("link", { name: SAMPLE_LINK }).first();
    await expect(first).toBeVisible();
    const orderNo = (await first.textContent()) ?? "";
    await page
      .getByRole("row", { name: new RegExp(orderNo) })
      .getByRole("cell")
      .nth(2)
      .click();
    const peek = page.getByRole("dialog");
    await expect(peek.getByText(orderNo)).toBeVisible();
    await expect(
      peek.getByRole("button", { name: "Next order" }),
    ).toBeEnabled();
    await peek.getByRole("link", { name: /Open order/ }).click();
    await expect(page).toHaveURL(
      (url) => url.pathname === `/orders/${orderNo}`,
    );
    await expect(
      page.getByRole("heading", { level: 1, name: orderNo }),
    ).toBeVisible();
    // The trail in the top bar ends with the order's number.
    await expect(
      page.getByRole("navigation", { name: /breadcrumb/i }).getByText(orderNo),
    ).toBeVisible();
  });

  test("an order's page says it is a sample, keeps its tab in the address, and is the same after a reload", async ({
    page,
  }) => {
    await signInAs(page, "SUPPORT");
    await page.goto("/orders?source=sample");
    await page.getByRole("link", { name: SAMPLE_LINK }).first().click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      SAMPLE_LINK,
    );
    await expect(
      page.getByText(
        "A sample order from Spectra. Samples are not edited here.",
      ),
    ).toBeVisible();
    await page.getByRole("tab", { name: /^Checks/ }).click();
    await expect(page).toHaveURL(/[?&]tab=checks/);
    await page.reload();
    await expect(page.getByRole("tab", { name: /^Checks/ })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  test("Warehouse reads an order's page with every price hidden, and with the reason", async ({
    page,
  }) => {
    await signInAs(page, "WAREHOUSE");
    await page.goto("/orders?source=sample");
    await page.getByRole("link", { name: SAMPLE_LINK }).first().click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      SAMPLE_LINK,
    );
    await expect(
      page.getByRole("table", { name: "Lines of the order" }),
    ).toBeVisible();
    await expect(page.getByText(/USD\s?[\d,]+\.\d{2}/)).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: /hidden/i }).first(),
    ).toHaveAccessibleDescription(
      /prices are for roles that work with pricing/,
    );
  });

  test("an order that does not exist says so and leads back to the list", async ({
    page,
  }) => {
    await signInAs(page, "SUPPORT");
    await page.goto("/orders/SO-99999999-9999");
    await expect(page.getByText("That order was not found")).toBeVisible();
    await page
      .getByRole("link", { name: "Orders", exact: true })
      .first()
      .click();
    await expect(page).toHaveURL((url) => url.pathname === "/orders");
  });

  test("the list and an order fit at a desktop and a phone width with no accessibility violations", async ({
    page,
  }) => {
    await signInAs(page, "SUPPORT");
    await page.goto("/orders");
    await checkPage(page);
    await page.goto("/orders?source=sample");
    await page.getByRole("link", { name: SAMPLE_LINK }).first().click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      SAMPLE_LINK,
    );
    await checkPage(page);
  });

  test("no cell of the list is wider than its column, at a desktop and a tablet width", async ({
    page,
  }) => {
    await signInAs(page, "SUPPORT");
    for (const [width, height] of [
      [1440, 900],
      [820, 1180],
    ] as const) {
      await page.setViewportSize({ width, height });
      await page.goto("/orders?source=sample");
      await expect(
        page.getByRole("link", { name: SAMPLE_LINK }).first(),
      ).toBeVisible();
      // A cell clips what does not fit (overflow hidden), so a figure cut
      // short shows as a cell whose content is wider than the cell.
      const clipped = await page.evaluate(() =>
        [...document.querySelectorAll(".od-table tbody td")]
          .filter((cell) => cell.scrollWidth > cell.clientWidth)
          .map((cell) => cell.textContent.trim().slice(0, 24)),
      );
      expect(clipped, `cells clipped at ${String(width)} px`).toEqual([]);
    }
  });

  test("a role without orders.read is refused by the server", async () => {
    await expectRefused("SYSTEM_ADMIN", "GET", "/orders");
    await expectRefused("SYSTEM_ADMIN", "GET", "/orders/SO-0001");
  });
});
