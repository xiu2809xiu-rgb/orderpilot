import { randomInt } from "node:crypto";
import {
  errorEnvelopeSchema,
  salesOrderResponseSchema,
  type CreateSalesOrderBody,
  type PatchSalesOrderBody,
  type SubmitSalesOrderBody,
  type VoidSalesOrderBody,
} from "@orderpilot/shared";
import type { Page } from "@playwright/test";
import {
  callAs,
  checkPage,
  expect,
  expectNoButton,
  expectRefused,
  apiUrl,
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

/** "USD 4,228.89" from "4228.89", as the page words an amount. */
function formatUsd(value: string): string {
  const [whole = "0", fraction = ""] = value.split(".");
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `USD ${grouped}.${fraction.padEnd(2, "0")}`;
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
  // The PO sets the price: picking an item leaves it empty.
  await page
    .getByRole("textbox", { name: "Unit price, line 1" })
    .fill("857.00");
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
  // The draft is no longer a form: the route opens the order's page, which says what became of it.
  await expect(
    page.getByText("Entered here and voided. It cannot be changed."),
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
    await expect(page.getByRole("link", { name: "New order" })).toBeVisible();
    await page.getByRole("link", { name: "New order" }).click();
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
        // A reader gets the order page, not the form: its facts say it is a draft.
        await expect(
          other.getByRole("heading", { level: 1, name: orderNo }),
        ).toBeVisible();
        await expect(
          other.getByText(
            "Entered here as a draft. Only a role that may edit orders can change it.",
          ),
        ).toBeVisible();
        await expect(
          other.getByRole("table", { name: "Lines of the order" }),
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

  test("the note under a line's price shows what the customer last paid, as the server says", async ({
    page,
  }) => {
    await signInAs(page, "SUPPORT");
    // The data is date-relative, so no date is asserted: the server names an
    // item this customer bought, and the page must show its price.
    const itemNos = Array.from(
      { length: 200 },
      (_, i) => `I-${String(i + 1).padStart(4, "0")}`,
    ).join(",");
    const answer = await page.request.get(
      apiUrl(`/master-data/customers/C-0001/last-prices?itemNos=${itemNos}`),
    );
    expect(answer.ok()).toBe(true);
    const body = (await answer.json()) as {
      data: { itemNo: string; price: { value: string | null } }[];
    };
    const bought = body.data.find((row) => row.price.value !== null);
    expect(bought, "C-0001 has a last price for some item").toBeDefined();
    const price = bought?.price.value ?? "";

    await page.goto("/orders/new");
    await expect(
      page.getByRole("heading", { level: 1, name: "New order" }),
    ).toBeVisible();
    await page.getByRole("combobox", { name: /^Customer$/ }).fill("C-0001");
    await page.getByRole("option").first().click();
    await page
      .getByRole("combobox", { name: "Item, line 1" })
      .fill(bought?.itemNo ?? "");
    await page.keyboard.press("Enter");
    await expect(
      page.getByText(`Last ${formatUsd(price)}`, { exact: true }),
    ).toBeVisible();
    // Context only: the price the PO sets is still the person's to type.
    await expect(
      page.getByRole("textbox", { name: "Unit price, line 1" }),
    ).toHaveValue("");
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

  test("a possible match is chosen with the down arrow and Enter, and never by Enter on the typed text alone", async ({
    page,
  }) => {
    await signInAs(page, "SUPPORT");
    await page.goto("/orders/new");
    await expect(
      page.getByRole("heading", { level: 1, name: "New order" }),
    ).toBeVisible();
    const customer = page.getByRole("combobox", { name: /^Customer$/ });
    const possible = page.getByRole("option", {
      name: /Vellamar Network.*possible match/,
    });

    // A customer of the base data set, misspelt by one letter: the demo
    // storyline's customer is not in the data this suite runs on in CI.
    // At the speed of a typist: the arrow comes before the search has
    // answered, which is where a component test, that waits, never looked.
    await customer.click();
    await page.keyboard.type("Vellamor");
    await page.keyboard.press("ArrowDown");
    await expect(possible).toHaveAttribute("aria-selected", "true");
    // Seen and highlighted, not chosen: the box still holds what was typed.
    await expect(customer).toHaveValue("Vellamor");
    await page.keyboard.press("Enter");
    await expect(customer).toHaveValue(/^C-\d{4}\s+Vellamar Network/);

    // Enter on the typed text alone never chooses the look-alike.
    await customer.fill("Vellamor");
    await expect(possible).toBeVisible();
    await page.keyboard.press("Enter");
    await expect(customer).toHaveValue("Vellamor");
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
    await expect(page.getByRole("link", { name: "New order" })).toHaveCount(0);

    const create = {
      customerNo: "C-0001",
      externalDocumentNo: "E2E-REFUSED",
      orderDate: "2026-11-09",
      shipmentDate: null,
      prepaymentPercent: "100",
      lines: [{ itemNo: "I-0001", quantity: "1", unitPrice: "857.00" }],
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
    await expect(page.getByRole("link", { name: "New order" })).toBeVisible();
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

// P-114: Submit an order. These tests leave submitted orders behind, and a
// submitted order cannot be voided or changed by anyone until P-50, so every
// run uses a PO number no earlier run used (freshPo) and a stack that is
// started clean by CI keeps none of them. On a persistent stack the customer
// C-0001 simply gains open orders, which no other spec counts.

/** Today on Singapore's calendar, as the form's date fields hold it. */
function todayInSingapore(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Singapore" });
}

/**
 * A submitted order made through the API, for a spec that only reads it. It is
 * created and submitted by Support, exactly as the page does, so the order is
 * the same one the page would have made.
 */
async function submittedOrderFor(po: string): Promise<string> {
  const create = {
    customerNo: "C-0001",
    externalDocumentNo: po,
    orderDate: todayInSingapore(),
    shipmentDate: null,
    prepaymentPercent: "100",
    lines: [{ itemNo: "I-0001", quantity: "2", unitPrice: "857.00" }],
  } satisfies CreateSalesOrderBody;
  const made = await callAs("SUPPORT", "POST", "/orders", create);
  expect(made.status, "the draft is created").toBe(201);
  const draft = salesOrderResponseSchema.parse(made.body).data;
  const body = { version: draft.version ?? 1 } satisfies SubmitSalesOrderBody;
  const sent = await callAs(
    "SUPPORT",
    "POST",
    `/orders/${draft.orderNo}/submit`,
    body,
  );
  expect(sent.status, "the draft is submitted").toBe(200);
  return draft.orderNo;
}

const SUBMITTED_NOTICE = "Submitted. No team has a task for it";

/** Presses Submit order on the draft's form and returns the dialog it opens. */
async function askToSubmit(page: Page) {
  const submit = page.getByRole("button", {
    name: "Submit order",
    exact: true,
  });
  await expect(submit).toBeVisible();
  // Right after a save the bar still says "Saving." and a press only explains.
  await expect(submit).not.toHaveAttribute("aria-disabled", "true");
  await submit.click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  return dialog;
}

test.describe("Submit an order", () => {
  test("Support submits a draft, the page says it is submitted and no team has a task, and nothing can change it", async ({
    page,
  }) => {
    test.setTimeout(120_000);
    const po = freshPo();
    await signInAs(page, "SUPPORT");
    const orderNo = await createOrder(page, po);
    // A clean saved draft: Submit order is the button to press.
    const dialog = await askToSubmit(page);
    await expect(
      dialog.getByRole("heading", { name: `Submit order ${orderNo}?` }),
    ).toBeVisible();
    await expect(dialog.getByText(/You cannot undo this/)).toBeVisible();
    // Enter must never submit by habit: focus starts on the safe button.
    await expect(
      dialog.getByRole("button", { name: "Keep editing" }),
    ).toBeFocused();

    await test.step("confirming ends with a short toast that has no Undo, and the notice holds focus", async () => {
      await dialog.getByRole("button", { name: "Submit order" }).click();
      await expect(page.getByText(`Order ${orderNo} submitted`)).toBeVisible();
      await expect(page.getByRole("button", { name: "Undo" })).toHaveCount(0);
      const notice = page.getByRole("region", { name: SUBMITTED_NOTICE });
      await expect(notice).toBeVisible();
      await expect(notice).toBeFocused();
      await expect(notice).toContainText("It is not approved.");
      await expect(
        page.getByRole("heading", { level: 1, name: orderNo }),
      ).toBeVisible();
      await expect(
        page.getByRole("button", { name: /^Submitted\./ }),
      ).toBeVisible();
      // The page says that nobody holds it, and says it in its own words.
      await expect(
        page.getByText("Not in the order flow").first(),
      ).toBeVisible();
      await expect(page.getByText("Nobody", { exact: true })).toBeVisible();
      await expect(
        page.getByRole("table", { name: "Lines of the order" }),
      ).toBeVisible();
    });

    await test.step("nothing on the page can change it", async () => {
      for (const name of ["Save", "Void", "Submit order"]) {
        await expect(
          page.getByRole("button", { name, exact: true }),
        ).toHaveCount(0);
      }
    });

    await test.step("a reload keeps the page and does not take focus again", async () => {
      await page.reload();
      const notice = page.getByRole("region", { name: SUBMITTED_NOTICE });
      await expect(notice).toBeVisible();
      await expect(notice).not.toBeFocused();
    });

    await test.step("the server refuses a second submit, saying it is already submitted", async () => {
      const again = await callAs(
        "SUPPORT",
        "POST",
        `/orders/${orderNo}/submit`,
        {
          version: 2,
        } satisfies SubmitSalesOrderBody,
      );
      expect(again.status).toBe(409);
      const envelope = errorEnvelopeSchema.parse(again.body);
      expect(envelope.error.code).toBe("CONFLICT");
      expect(envelope.error.message).toContain("is already submitted");
    });

    await test.step("the same PO number is a repeat, and the notice says what can be done", async () => {
      await page.goto("/orders/new");
      await fillNewOrder(page, po);
      await saveButton(page).click();
      await expect(page.getByText("This order already exists")).toBeVisible();
      await expect(
        page.getByText(
          "A draft can be edited, and a submitted order cannot be changed here.",
        ),
      ).toBeVisible();
      await expect(
        page.getByRole("link", { name: `Open ${orderNo}` }),
      ).toBeVisible();
    });
  });

  test("Keep editing sends nothing, and the draft stays a draft with its button back in focus", async ({
    page,
  }) => {
    test.setTimeout(120_000);
    await signInAs(page, "SUPPORT");
    const orderNo = await createOrder(page, freshPo());
    const dialog = await askToSubmit(page);
    await dialog.getByRole("button", { name: "Keep editing" }).click();
    await expect(dialog).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Submit order", exact: true }),
    ).toBeFocused();
    await expect(
      page.getByRole("heading", { name: `Sales order ${orderNo}` }),
    ).toBeVisible();
    await voidDraft(page, orderNo);
  });

  test("a Product Manager is offered Submit order on a draft too", async ({
    page,
  }) => {
    test.setTimeout(120_000);
    await signInAs(page, "PRODUCT_MANAGER");
    const orderNo = await createOrder(page, freshPo());
    await expect(
      page.getByRole("button", { name: "Submit order", exact: true }),
    ).toBeVisible();
    await voidDraft(page, orderNo);
  });

  test("Warehouse reads a submitted order with its prices hidden and cannot submit one", async ({
    page,
  }) => {
    test.setTimeout(120_000);
    const orderNo = await submittedOrderFor(freshPo());
    await signInAs(page, "WAREHOUSE");
    await page.goto(`/orders/${orderNo}`);
    await expect(
      page.getByRole("heading", { level: 1, name: orderNo }),
    ).toBeVisible();
    const notice = page.getByRole("region", { name: SUBMITTED_NOTICE });
    await expect(notice).toBeVisible();
    // Only a role that may edit orders reads what a mistake means.
    await expect(page.getByText(/submitted by mistake/)).toHaveCount(0);
    await expect(
      page.getByRole("table", { name: "Lines of the order" }),
    ).toBeVisible();
    await expect(page.getByText(/USD\s?[\d,]+\.\d{2}/)).toHaveCount(0);
    for (const name of ["Save", "Void", "Submit order"]) {
      await expect(page.getByRole("button", { name, exact: true })).toHaveCount(
        0,
      );
    }
    await expectRefused("WAREHOUSE", "POST", `/orders/${orderNo}/submit`, {
      version: 2,
    } satisfies SubmitSalesOrderBody);
  });

  test("the open dialog and the submitted page fit and pass the accessibility check", async ({
    page,
  }) => {
    test.setTimeout(180_000);
    await signInAs(page, "SUPPORT");
    const orderNo = await createOrder(page, freshPo());
    const dialog = await askToSubmit(page);
    await checkPage(page);
    await dialog.getByRole("button", { name: "Submit order" }).click();
    await expect(
      page.getByRole("region", { name: SUBMITTED_NOTICE }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { level: 1, name: orderNo }),
    ).toBeVisible();
    await checkPage(page);
  });
});
