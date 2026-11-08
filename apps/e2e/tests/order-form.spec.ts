import { randomInt } from "node:crypto";
import type {
  CreateSalesOrderBody,
  PatchSalesOrderBody,
  VoidSalesOrderBody,
} from "@orderpilot/shared";
import type { Page } from "@playwright/test";
import {
  checkPage,
  expect,
  expectNoButton,
  expectRefused,
  signInAs,
  test,
} from "../src/index.js";

// P-49: New order and draft editing. An allowed role creates a draft by
// searching, sees live stock on the line, edits it, is stopped by a repeated
// PO number with a link to the order, and voids the draft with a reason. A
// role without the permission sees no button and is refused by the server.

/** A PO number no earlier run used, so a persistent stack never clashes. */
function freshPo(): string {
  return `E2E-${String(Date.now())}-${String(randomInt(1000, 9999))}`;
}

/** Fills the new-order form the way a person does: by searching, not by typing a name. */
async function fillNewOrder(page: Page, po: string): Promise<void> {
  // The page loads lazily: the list stays on screen until the form is there.
  await expect(
    page.getByRole("heading", { level: 1, name: "New order" }),
  ).toBeVisible();
  const customer = page.getByRole("combobox", { name: /^Customer$/ });
  await customer.fill("C-0001");
  await page.getByRole("option").first().click();
  await page.getByRole("textbox", { name: /Customer PO number/ }).fill(po);
  await page.getByRole("combobox", { name: "Item, line 1" }).fill("I-0001");
  await page.keyboard.press("Enter");
  const quantity = page.getByRole("textbox", { name: "Quantity, line 1" });
  await expect(quantity).toBeFocused();
  await quantity.fill("2");
}

const saveButton = (page: Page) =>
  page.getByRole("button", { name: "Save", exact: true });

/** Saves a new order and returns the number the server gave it. */
async function createOrder(page: Page, po: string): Promise<string> {
  await page.goto("/orders/new");
  await fillNewOrder(page, po);
  await saveButton(page).click();
  await expect(page).toHaveURL(/\/orders\/SO-\d{8}-\d{4}$/);
  return new URL(page.url()).pathname.split("/").pop() ?? "";
}

/** Voids the draft on the page, with a reason, as a person does. */
async function voidDraft(page: Page, orderNo: string): Promise<void> {
  await page.getByRole("button", { name: "Void", exact: true }).click();
  await page.getByRole("textbox", { name: /Reason/ }).fill("E2E clean-up");
  await page.getByRole("button", { name: "Void order" }).click();
  await expect(page.getByText(`Order ${orderNo} voided`)).toBeVisible();
  await expect(
    page.getByText("This order is void. It cannot be changed."),
  ).toBeVisible();
}

test.describe("New order and draft editing", () => {
  test("Support creates, edits and voids a draft, and a repeated PO number links to the order", async ({
    page,
    browser,
  }) => {
    test.setTimeout(120_000);
    const po = freshPo();
    await signInAs(page, "SUPPORT");
    await page.goto("/orders");
    await expect(page.getByRole("button", { name: "New order" })).toBeVisible();
    await page.getByRole("button", { name: "New order" }).click();
    await expect(page).toHaveURL((url) => url.pathname === "/orders/new");

    await fillNewOrder(page, po);
    // The stock beside the line comes from the server, in the item's unit.
    await expect(page.getByText(/ available/).first()).toBeVisible();
    await saveButton(page).click();
    await expect(page).toHaveURL(/\/orders\/SO-\d{8}-\d{4}$/);
    const orderNo = new URL(page.url()).pathname.split("/").pop() ?? "";
    await expect(
      page.getByRole("heading", { name: `Sales order ${orderNo}` }),
    ).toBeVisible();
    await expect(
      page.getByText("Draft", { exact: true }).first(),
    ).toBeVisible();

    await test.step("edit the quantity and save again", async () => {
      const quantity = page.getByRole("textbox", { name: "Quantity, line 1" });
      await quantity.fill("3");
      await saveButton(page).click();
      await expect(page.getByText(`Order ${orderNo} saved`)).toBeVisible();
      // Right after a save the form may write, and then drop, a draft of itself for
      // under a second; a reload inside that time would bring it back with
      // the old version. A person does not reload that fast, so wait it out.
      await page.waitForTimeout(1_500);
      await expect
        .poll(() =>
          page.evaluate(() =>
            Object.keys(localStorage).filter((key) => key.includes(".order.")),
          ),
        )
        .toEqual([]);
      await page.reload();
      await expect(
        page.getByRole("textbox", { name: "Quantity, line 1" }),
      ).toHaveValue("3");
    });

    await test.step("a repeated PO number names the order and links to it", async () => {
      await page.goto("/orders/new");
      await fillNewOrder(page, po.toLowerCase());
      await saveButton(page).click();
      await expect(page.getByText("This order already exists")).toBeVisible();
      const link = page.getByRole("link", { name: `Open ${orderNo}` });
      await link.click();
      // The unsaved form asks before it is left, as it does for any link.
      await page.getByRole("button", { name: "Leave this page" }).click();
      await expect(page).toHaveURL(
        (url) => url.pathname === `/orders/${orderNo}`,
      );
    });

    await test.step("Warehouse reads the draft with prices hidden and cannot change it", async () => {
      const context = await browser.newContext({ reducedMotion: "reduce" });
      try {
        const other = await context.newPage();
        await signInAs(other, "WAREHOUSE");
        await other.goto(`/orders/${orderNo}`);
        await expect(
          other.getByRole("heading", { name: `Sales order ${orderNo}` }),
        ).toBeVisible();
        await expect(
          other.getByText("Your role may read orders but not change them."),
        ).toBeVisible();
        await expect(other.getByText(/USD\s?[\d,]+\.\d{2}/)).toHaveCount(0);
        await expect(
          other.getByRole("button", { name: "Void", exact: true }),
        ).toHaveCount(0);
        await expect(other.getByRole("button", { name: "Save" })).toHaveCount(
          0,
        );
      } finally {
        await context.close();
      }
    });

    await test.step("Support voids it with a reason, and the PO number is free again", async () => {
      await voidDraft(page, orderNo);
      const again = await createOrder(page, po);
      expect(again).not.toBe(orderNo);
      await voidDraft(page, again);
    });
  });

  test("the draft page fits and passes the accessibility check", async ({
    page,
  }) => {
    test.setTimeout(120_000);
    await signInAs(page, "SUPPORT");
    const orderNo = await createOrder(page, freshPo());
    await checkPage(page);
    await voidDraft(page, orderNo);
  });

  test("Warehouse sees no New order button, and the server refuses its writes", async ({
    page,
  }) => {
    await signInAs(page, "WAREHOUSE");
    await page.goto("/orders");
    await expect(
      page.getByRole("link", { name: /^SO-\d{4}$/ }).first(),
    ).toBeVisible();
    await expectNoButton(page, "New order");

    const create = {
      customerNo: "C-0001",
      externalDocumentNo: "E2E-REFUSED",
      orderDate: "2026-11-09",
      shipmentDate: null,
      prepaymentPercent: "100",
      lines: [{ itemNo: "I-0001", quantity: "1", unitPrice: "10.00" }],
    } satisfies CreateSalesOrderBody;
    const patch = {
      version: 1,
      externalDocumentNo: "E2E-REFUSED-2",
    } satisfies PatchSalesOrderBody;
    const voided = {
      version: 1,
      reason: "Not allowed",
    } satisfies VoidSalesOrderBody;
    await expectRefused("WAREHOUSE", "POST", "/orders", create);
    await expectRefused(
      "WAREHOUSE",
      "PATCH",
      "/orders/SO-20261109-0001",
      patch,
    );
    await expectRefused(
      "WAREHOUSE",
      "POST",
      "/orders/SO-20261109-0001/void",
      voided,
    );
    // The System admin configures the platform and never enters an order.
    await expectRefused("SYSTEM_ADMIN", "POST", "/orders", create);
  });

  test("N and Ctrl+K start a new order for Support and are absent for Warehouse", async ({
    page,
  }) => {
    await signInAs(page, "SUPPORT");
    await page.goto("/orders");
    await expect(page.getByRole("button", { name: "New order" })).toBeVisible();
    await page.keyboard.press("n");
    await expect(page).toHaveURL((url) => url.pathname === "/orders/new");

    await page.goto("/");
    await expect(page.locator("main")).toBeVisible();
    await page.keyboard.press("Control+K");
    await expect(
      page.getByRole("option", { name: "Start a new order" }),
    ).toBeVisible();
  });

  test("Warehouse does not get N or the Ctrl+K entry", async ({ page }) => {
    await signInAs(page, "WAREHOUSE");
    await page.goto("/orders");
    await expect(
      page.getByRole("link", { name: /^SO-\d{4}$/ }).first(),
    ).toBeVisible();
    await page.keyboard.press("n");
    await expect(page).toHaveURL((url) => url.pathname === "/orders");
    await page.goto("/");
    await expect(page.locator("main")).toBeVisible();
    await page.keyboard.press("Control+K");
    await expect(page.getByRole("group", { name: "Go to" })).toBeVisible();
    await expect(
      page.getByRole("option", { name: "Start a new order" }),
    ).toHaveCount(0);
  });
});
