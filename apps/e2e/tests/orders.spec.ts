import { randomInt } from "node:crypto";
import {
  salesOrderResponseSchema,
  type CreateSalesOrderBody,
  type VoidSalesOrderBody,
} from "@orderpilot/shared";
import {
  callAs,
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
    // Signed in first, so nothing that can fail stands between entering the
    // draft and the block that voids it.
    await signInAs(page, "SUPPORT");
    // An order entered here is numbered by its date, the longest number the
    // list shows, and carries its entry chip; this one is worth six figures
    // (USD 171,400.00), wider than any sample. Enter it, so the list has it.
    const created = await callAs("SUPPORT", "POST", "/orders", {
      customerNo: "C-0001",
      externalDocumentNo: `E2E-${String(Date.now())}-${String(randomInt(1000, 9999))}`,
      orderDate: new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Singapore",
      }).format(new Date()),
      shipmentDate: null,
      prepaymentPercent: "100",
      lines: [{ itemNo: "I-0001", quantity: "200", unitPrice: "857.00" }],
    } satisfies CreateSalesOrderBody);
    expect(created.status, "Support enters a draft").toBe(201);
    const draft = salesOrderResponseSchema.parse(created.body).data;
    try {
      for (const [width, height] of [
        [1440, 900],
        [820, 1180],
      ] as const) {
        await page.setViewportSize({ width, height });
        for (const [list, row] of [
          [
            "/orders?source=sample",
            page.getByRole("link", { name: SAMPLE_LINK }).first(),
          ],
          [
            `/orders?source=stored&q=${draft.orderNo}`,
            page.getByRole("link", { name: draft.orderNo, exact: true }),
          ],
        ] as const) {
          await page.goto(list);
          await expect(row).toBeVisible();
          // A cell clips what does not fit (overflow hidden), so a figure cut
          // short shows as a cell whose content is wider than the cell.
          const clipped = await page.evaluate(() =>
            [...document.querySelectorAll(".od-table tbody td")]
              .filter((cell) => cell.scrollWidth > cell.clientWidth)
              .map((cell) => cell.textContent.trim().slice(0, 24)),
          );
          expect(
            clipped,
            `cells clipped on ${list} at ${String(width)} px`,
          ).toEqual([]);
        }
      }
    } finally {
      const voided = await callAs(
        "SUPPORT",
        "POST",
        `/orders/${draft.orderNo}/void`,
        {
          // A stored order always has a version; only a sample has none.
          version: draft.version ?? 1,
          reason: "E2E clean-up",
        } satisfies VoidSalesOrderBody,
      );
      // Soft, so a failed clean-up is reported beside the check's own failure
      // rather than in place of it.
      expect
        .soft(voided.status, "the draft is voided after the check")
        .toBe(200);
    }
  });

  test("a role without orders.read is refused by the server", async () => {
    await expectRefused("SYSTEM_ADMIN", "GET", "/orders");
    await expectRefused("SYSTEM_ADMIN", "GET", "/orders/SO-0001");
  });
});

// A touch screen is what the warehouse uses: Chromium reports a coarse pointer
// for a context with touch, so the page takes its touch sizes.
test.describe("The Orders workspace on a touch screen", () => {
  test.use({ hasTouch: true, viewport: { width: 820, height: 1180 } });

  test("each checkbox and row menu is a whole 44 px target, and the pinned order column covers none of the customer column", async ({
    page,
  }) => {
    await signInAs(page, "SUPPORT");
    await page.goto("/orders?source=sample");
    await expect(
      page.getByRole("link", { name: SAMPLE_LINK }).first(),
    ).toBeVisible();
    const found = await page.evaluate(() => {
      const box = (element: Element | null | undefined) => {
        if (!element) return null;
        const rect = element.getBoundingClientRect();
        return { left: rect.left, right: rect.right, width: rect.width };
      };
      const cells = [
        ...document.querySelectorAll(".od-table tbody tr:first-child td"),
      ];
      const first = cells[0];
      const last = cells[cells.length - 1];
      return {
        select: box(first),
        checkbox: box(first?.querySelector("button")),
        order: box(cells[1]),
        customer: box(cells[2]),
        actions: box(last),
        menu: box(last?.querySelector("button")),
        // A cell clips what does not fit, so a button cut short shows here.
        clipped: [...document.querySelectorAll(".od-table tbody td")].filter(
          (cell) => cell.scrollWidth > cell.clientWidth,
        ).length,
      };
    });
    const { select, checkbox, order, customer, actions, menu } = found;
    if (!select || !checkbox || !order || !customer || !actions || !menu) {
      throw new Error("The first row is missing a cell or a button.");
    }
    for (const [name, button, cell] of [
      ["checkbox", checkbox, select],
      ["row menu", menu, actions],
    ] as const) {
      expect(button.width, `the ${name} button`).toBeGreaterThanOrEqual(44);
      expect(button.left, `the ${name} starts in its cell`).toBeGreaterThan(
        cell.left - 0.5,
      );
      expect(button.right, `the ${name} ends in its cell`).toBeLessThan(
        cell.right + 0.5,
      );
    }
    expect(found.clipped, "cells that clip what they hold").toBe(0);
    expect(
      order.right,
      "the pinned order cell ends where the customer cell starts",
    ).toBeLessThanOrEqual(customer.left + 0.5);
  });
});
