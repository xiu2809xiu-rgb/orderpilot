import { checkPage, expect, signInAs, test } from "../src/index.js";

// P-47: the document form template. The gallery's sales order is the one
// screen that declares every action and every tab, with a fake server.

test.describe("The document form on the gallery", () => {
  test("Support sees the actions Support may use, and Save waits for a change", async ({
    page,
  }) => {
    await signInAs(page, "SUPPORT");
    await page.goto("/gallery");
    const form = page.getByRole("form", { name: "Sales order" });
    await expect(form).toBeVisible();
    const save = form.getByRole("button", { name: "Save", exact: true });
    await expect(save).toHaveAttribute("aria-disabled", "true");
    await expect(
      form.getByRole("button", { name: "Submit for approval" }),
    ).toBeVisible();
    // Approve and Reject are declared by the form, but Support may not decide.
    await expect(
      form.getByRole("button", { name: "Approve", exact: true }),
    ).toHaveCount(0);
    await expect(
      form.getByRole("button", { name: "Reject", exact: true }),
    ).toHaveCount(0);

    await form
      .getByRole("textbox", { name: /Customer PO number/ })
      .fill("CPO-8800");
    await expect(save).not.toHaveAttribute("aria-disabled", "true");
    await save.click();
    await expect(page.getByText(/Saved\. Nothing was sent/)).toBeVisible();
  });

  test("the server's words land on the field", async ({ page }) => {
    await signInAs(page, "SUPPORT");
    await page.goto("/gallery");
    const form = page.getByRole("form", { name: "Sales order" });
    await form
      .getByRole("textbox", { name: /Customer PO number/ })
      .fill("CPO-USED");
    await form.getByRole("button", { name: "Save", exact: true }).click();
    await expect(
      form.getByText("PO CPO-USED is already on another order."),
    ).toBeVisible();
  });

  test("an approver can approve a document waiting for approval, and Void asks why", async ({
    page,
  }) => {
    await signInAs(page, "APPROVER");
    await page.goto("/gallery");
    await page.getByLabel("Status of the demo order").click();
    await page.getByRole("option", { name: "Waiting for approval" }).click();
    const form = page.getByRole("form", { name: "Sales order" });
    await expect(
      form.getByRole("button", { name: "Approve", exact: true }),
    ).not.toHaveAttribute("aria-disabled", "true");
    await form.getByRole("button", { name: "Void", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Void this order?" });
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "Void", exact: true }).click();
    await expect(dialog.getByRole("alert")).toBeVisible();
    await dialog
      .getByRole("textbox", { name: /Reason/ })
      .fill("Customer withdrew");
    await dialog.getByRole("button", { name: "Void", exact: true }).click();
    await expect(form.getByText("Void", { exact: true }).first()).toBeVisible();
  });

  test("the tabs below the form move with the keyboard", async ({ page }) => {
    await signInAs(page, "SUPPORT");
    await page.goto("/gallery");
    const timeline = page.getByRole("tab", { name: "Timeline" });
    await timeline.focus();
    await page.keyboard.press("ArrowRight");
    await expect(page.getByRole("tab", { name: /^Checks/ })).toBeFocused();
    await expect(
      page.getByText("Quantity on the packing list differs from the PO"),
    ).toBeVisible();
  });

  test("fits at a desktop and a phone width with no accessibility violations", async ({
    page,
  }) => {
    await signInAs(page, "SUPPORT");
    await page.goto("/gallery");
    await expect(page.getByRole("form", { name: "Sales order" })).toBeVisible();
    await checkPage(page);
  });
});
