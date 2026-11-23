import type { AuditChainCheck } from "@orderpilot/shared";
import { checkPage, expect, signInAs, test } from "../src/index.js";

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
});
