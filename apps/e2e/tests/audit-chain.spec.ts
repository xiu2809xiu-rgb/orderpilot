import type { AuditChainCheck, AuditEventView } from "@orderpilot/shared";
import { apiUrl, checkPage, expect, signInAs, test } from "../src/index.js";

// F-10. The system admin, as in F-9's tests: ADR 0058 retires the auditor.
// jsdom has no WebGL, so only a real browser shows that the shader compiles
// and links: GlCanvas draws its CSS fallback when either fails.
test.describe("F-10: the picture of the chain check", () => {
  test("draws the chain with WebGL once the check answers, numbered only as the check says", async ({
    page,
  }) => {
    await signInAs(page, "SYSTEM_ADMIN");
    await page.goto("/audit");
    const answered = page.waitForResponse(
      (res) =>
        res.request().method() === "GET" &&
        new URL(res.url()).pathname.endsWith("/audit/chain"),
    );
    await page.getByRole("button", { name: "Check the chain" }).click();
    const check = ((await (await answered).json()) as { data: AuditChainCheck })
      .data;

    const picture = page.locator("[data-chain-picture]");
    await expect(picture.locator("canvas")).toBeVisible();
    await expect(picture.locator("[data-fallback]")).toHaveCount(0);
    await expect(picture).toHaveAttribute("aria-hidden", "true");

    const sent = [check.verifiedThrough, check.brokenAtSequence].flatMap((n) =>
      n === null ? [] : [String(n)],
    );
    const shown = await picture.locator("span").allTextContents();
    expect(shown.length).toBeGreaterThan(0);
    for (const number of shown) expect(sent).toContain(number);

    await checkPage(page);
  });

  test("opens the event a break is at from the red block, as Open event N does", async ({
    page,
  }) => {
    await signInAs(page, "SYSTEM_ADMIN");
    // The real trail verifies, so the break is staged on its two newest events.
    const newest = (
      (await (
        await page.request.get(apiUrl("/audit/events?pageSize=2"))
      ).json()) as { data: AuditEventView[] }
    ).data;
    const [broken, before] = newest;
    if (!broken || !before) throw new Error("The trail needs two events");
    await page.route("**/api/v1/audit/chain", (route) =>
      route.fulfill({
        json: {
          data: {
            ok: false,
            checked: 1,
            verifiedThrough: before.sequence,
            brokenAtSequence: broken.sequence,
            brokenAtEventId: broken.id,
            problem: "hash-mismatch",
            checkedAt: new Date().toISOString(),
          },
        },
      }),
    );
    await page.goto("/audit");
    await page.getByRole("button", { name: "Check the chain" }).click();

    const open = page.getByRole("link", {
      name: `Open event ${String(broken.sequence)}`,
    });
    const block = page.locator("[data-chain-break]");
    await expect(block).toHaveAttribute(
      "href",
      (await open.getAttribute("href")) ?? "",
    );
    await expect(block).toHaveAttribute("tabindex", "-1");
    // A real click on the canvas's spot lands on the link, not the canvas.
    await block.click();
    await expect(page.getByRole("dialog")).toContainText(
      `Event ${String(broken.sequence)}`,
    );
  });
});
