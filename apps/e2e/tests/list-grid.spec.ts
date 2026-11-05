import {
  checkPage,
  expect,
  expectRefused,
  signInAs,
  test,
} from "../src/index.js";

// P-45: the list template's grid. A row is ticked, the count says so, the
// record's operation log opens at the foot, and a role that may not read the
// record is refused by the server (a screen that hides the panel proves
// nothing). The gallery list is the one screen that declares every feature.

test.describe("The list grid on the gallery list", () => {
  test("a ticked row is counted and opens its operation log", async ({
    page,
  }) => {
    await signInAs(page, "SUPPORT");
    await page.goto("/gallery");
    const rows = page.getByRole("checkbox", { name: /^Select (?!all)/ });
    await expect(rows.first()).toBeVisible();
    await expect(
      page.getByText("Select one row to see who changed it, and when."),
    ).toBeVisible();

    await rows.first().check();
    await expect(page.getByText("1 selected")).toBeVisible();
    await expect(page.getByText(/^Operation log: SO-/)).toBeVisible();

    await page.getByRole("button", { name: "Clear selection" }).click();
    await expect(page.getByText("1 selected")).toHaveCount(0);
  });

  test("the row menu opens from the keyboard", async ({ page }) => {
    await signInAs(page, "SUPPORT");
    await page.goto("/gallery");
    const menu = page.getByRole("button", { name: /^Actions for / }).first();
    await menu.focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("menuitem", { name: "Void" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("menuitem")).toHaveCount(0);
  });

  test("fits at a desktop and a phone width with no accessibility violations", async ({
    page,
  }) => {
    await signInAs(page, "SUPPORT");
    await page.goto("/gallery");
    await checkPage(page);
  });

  test("Print streams the list into a print frame, not into the page", async ({
    page,
  }) => {
    await signInAs(page, "SUPPORT");
    await page.goto("/gallery");
    await expect(page.getByRole("button", { name: "Print" })).toBeVisible();
    // The frame is removed when printing ends, so read what it held on the way out.
    await page.evaluate(() => {
      const remove = (el: HTMLIFrameElement) => {
        el.parentNode?.removeChild(el);
      };
      HTMLIFrameElement.prototype.remove = function () {
        const rows = this.contentDocument?.querySelectorAll("tbody tr").length;
        (window as unknown as { printedRows: number }).printedRows = rows ?? 0;
        remove(this);
      };
    });
    const attached = page.waitForEvent("frameattached");
    await page.getByRole("button", { name: "Print" }).click();
    expect((await attached).parentFrame()).toBe(page.mainFrame());
    await expect
      .poll(() =>
        page.evaluate(
          () => (window as unknown as { printedRows?: number }).printedRows,
        ),
      )
      .toBeGreaterThan(0);
  });

  test("a role that may not read a record is refused the log by the server", async ({
    page,
  }) => {
    await signInAs(page, "WAREHOUSE");
    await expectRefused(
      "WAREHOUSE",
      "GET",
      "/operation-log/User/00000000-0000-4000-8000-000000000001",
    );
  });
});
