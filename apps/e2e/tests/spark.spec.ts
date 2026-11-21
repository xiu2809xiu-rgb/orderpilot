import { chromium, type Locator, type Page } from "@playwright/test";
import { BASE_URL, expect, signInAs, test } from "../src/index.js";

// The Spark orb. CI runs headless Chromium with no GPU, on data without the
// demo storyline, so this asserts only what holds there: an orb is on the
// screen at once whatever draws it, and reduced motion gives the still orb with
// no GPU work. The measured figures (how long the GPU orb takes, how much idle
// moves) are in the pull request, from a browser with a real GPU.

async function openSpark(page: Page): Promise<Locator> {
  await page.getByRole("button", { name: "Spark", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Spark" });
  await expect(dialog).toBeVisible();
  return dialog.getByRole("img", { name: "Spark is ready" });
}

/** The orb is a drawn thing or the CSS orb: never an empty holder. */
function whatIsDrawn(orb: Locator): Locator {
  return orb.locator('.spark-orb-still, [data-ready="true"]');
}

test.describe("The Spark orb with motion allowed", () => {
  test.use({ reducedMotion: "no-preference" });

  test("is on the screen as soon as the panel opens, on every open", async ({
    page,
  }) => {
    await signInAs(page, "SUPPORT");
    await page.goto("/");
    const orb = await openSpark(page);
    await expect(orb).toBeVisible();
    // Said by the holder, so a test and a person's tools can tell which it is.
    await expect(orb).toHaveAttribute("data-showing", /^(css|webgpu|webgl)$/);
    await expect(whatIsDrawn(orb).first()).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog", { name: "Spark" })).toBeHidden();
    const again = await openSpark(page);
    await expect(again).toBeVisible();
    await expect(whatIsDrawn(again).first()).toBeVisible();
  });
});

test.describe("The Spark orb where neither WebGPU nor WebGL works", () => {
  // Launch arguments cannot be set for one group of tests, so this one
  // starts its own browser, without a GPU and without WebGL.
  test("shows the CSS orb, and the light in it moves", async () => {
    const browser = await chromium.launch({
      args: ["--disable-gpu", "--disable-webgl", "--disable-3d-apis"],
    });
    try {
      const context = await browser.newContext({
        baseURL: BASE_URL,
        reducedMotion: "no-preference",
        viewport: { width: 1440, height: 900 },
      });
      const page = await context.newPage();
      await page.addInitScript(() => {
        localStorage.setItem("op.analytics.consent", "denied");
      });
      await signInAs(page, "SUPPORT");
      await page.goto("/");
      const orb = await openSpark(page);
      await expect(orb).toHaveAttribute("data-engine", "still");
      await expect(orb).toHaveAttribute("data-showing", "css");
      const css = orb.locator(".spark-orb-still");
      await expect(css).toBeVisible();
      const motion = await css.evaluate((node) => {
        const turn = getComputedStyle(node, "::before");
        return {
          name: turn.animationName,
          state: turn.animationPlayState,
          display: turn.display,
        };
      });
      expect(motion).toEqual({
        name: "spark-orb-turn",
        state: "running",
        display: "block",
      });
    } finally {
      await browser.close();
    }
  });
});

test.describe("The Spark orb under reduced motion", () => {
  test.use({ reducedMotion: "reduce" });

  test("is the still orb, with no animation and no canvas to draw on", async ({
    page,
  }) => {
    await signInAs(page, "SUPPORT");
    await page.goto("/");
    const orb = await openSpark(page);
    await expect(orb).toHaveAttribute("data-engine", "still");
    await expect(orb).toHaveAttribute("data-showing", "css");
    await expect(orb.locator(".spark-orb-still")).toBeVisible();
    await expect(orb.locator("canvas")).toHaveCount(0);
    const light = await orb
      .locator(".spark-orb-still")
      .evaluate((node) => getComputedStyle(node, "::before").display);
    expect(light).toBe("none");
  });
});
