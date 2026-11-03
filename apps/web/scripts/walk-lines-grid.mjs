// Walks the lines grid on the demo gallery, in the production build, at 1440,
// 1024 (a tablet in landscape, touch) and 390 px wide in light and dark, and takes the pictures. It types the way
// Support would: no mouse for the entry itself. No API, no database, no Docker:
// the API is answered by the browser. Run `pnpm build` first, then
//   node apps/web/scripts/walk-lines-grid.mjs
// Playwright comes from apps/e2e (pnpm install there), or from PLAYWRIGHT_DIR.

// The functions given to page.evaluate run in the browser, so they use its globals.
/* global document, window, requestAnimationFrame, getComputedStyle */

import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { setTimeout as sleep } from "node:timers/promises";

const webDir = path.resolve(import.meta.dirname, "..");
const outDir = path.resolve(webDir, "../../docs/design/screenshots/platform");
const port = process.env.WEB_PORT ?? "4173";
const base = `http://localhost:${port}`;
const playwrightDir =
  process.env.PLAYWRIGHT_DIR ?? path.resolve(webDir, "../e2e");
const { chromium } = createRequire(path.join(playwrightDir, "x.js"))(
  "@playwright/test",
);

const session = {
  user: {
    id: "00000000-0000-4000-8000-000000000004",
    displayName: "Priya Nair",
    email: "support@example.test",
    role: "SUPPORT",
  },
  permissions: [
    "orders.read",
    "documents.read",
    "documents.upload",
    "tracker.read",
  ],
  expiresAt: new Date(Date.now() + 60 * 60_000).toISOString(),
  demo: true,
};
const json = (status, body) => ({
  status,
  contentType: "application/json",
  body: JSON.stringify(body),
});

async function mockApi(context) {
  await context.route("**/api/v1/**", (route) => {
    const key = new URL(route.request().url()).pathname.replace("/api/v1", "");
    if (key === "/auth/me") return route.fulfill(json(200, { data: session }));
    if (key === "/auth/options") {
      return route.fulfill(
        json(200, { data: { demoMode: true, demoRoles: [] } }),
      );
    }
    // Anything else is "not found", never "signed out": a 401 would end the
    // session the page was just given.
    return route.fulfill(
      json(404, {
        error: {
          code: "NOT_FOUND",
          message: "n/a",
          details: null,
          traceId: "walk",
        },
      }),
    );
  });
}

async function startPreview() {
  const vite = path.resolve(webDir, "node_modules/vite/bin/vite.js");
  const child = spawn(process.execPath, [vite, "preview"], {
    cwd: webDir,
    env: { ...process.env, WEB_PORT: port },
    stdio: "ignore",
  });
  for (let i = 0; i < 50; i++) {
    try {
      await fetch(base);
      return child;
    } catch {
      await sleep(200);
    }
  }
  throw new Error("vite preview did not start");
}

const problems = [];
const shots = [];
const report = [];
const check = (ok, what) => {
  if (!ok) problems.push(what);
};

async function shoot(locator, name, theme, size) {
  const file = path.join(outDir, `lines-grid-${name}-${theme}-${size}.png`);
  await locator.screenshot({ path: file });
  shots.push(file);
}

// A required field's label ends in a mark, so the name is matched as text, not
// exactly. Each name used here is not the start of another line's.
const cell = (page, label) => page.getByLabel(label);

async function entryWalk(page, label) {
  const grid = page.getByRole("table", { name: "Order lines" });
  // Enter on the last cell of line 2 adds line 3 and lands in its item cell.
  await cell(page, "Unit price, line 2").focus();
  await page.keyboard.press("Enter");
  await cell(page, "Item, line 3").waitFor();
  check(
    await cell(page, "Item, line 3").evaluate(
      (e) => e === document.activeElement,
    ),
    `${label}: Enter on the last cell did not focus the new item cell`,
  );
  // A part number resolves on Enter and lands on the quantity.
  await page.keyboard.type("nv-wk-200");
  await page.keyboard.press("Enter");
  await page.waitForFunction(
    () => document.activeElement?.getAttribute("name") === "lines.2.quantity",
    null,
    { timeout: 5000 },
  );
  check(
    (await cell(page, "Unit price, line 3").inputValue()) === "24.90",
    `${label}: picking the item did not fill the default price`,
  );
  await page.keyboard.type("10");
  await page.keyboard.press("Enter");
  check(
    await cell(page, "Unit price, line 3").evaluate(
      (e) => e === document.activeElement,
    ),
    `${label}: Enter on the quantity did not move on to the price`,
  );
  // Delete in a field edits text; it does not remove the line.
  await page.keyboard.press("Home");
  await page.keyboard.press("Delete");
  check(
    (await grid.locator("[data-row]").count()) === 3,
    `${label}: Delete ate a line`,
  );
  // Escape selects the line, Delete removes it, Undo brings it back.
  await page.keyboard.press("Escape");
  await page.keyboard.press("Delete");
  check(
    (await grid.locator("[data-row]").count()) === 2,
    `${label}: Delete on the line did not remove it`,
  );
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await page.waitForFunction(
    () => document.querySelectorAll("[data-row]").length === 3,
  );
}

async function layoutChecks(page, label, touch, stacked) {
  // A tablet in landscape keeps the grid: one row of tracks per line.
  const tracks = await page.evaluate(() => {
    const row = document.querySelector("[data-row]");
    return row
      ? getComputedStyle(row).gridTemplateColumns.split(" ").length
      : 0;
  });
  check(
    stacked ? tracks <= 2 : tracks >= 6,
    `${label}: ${String(tracks)} columns per line, expected ${stacked ? "a stack" : "a grid"}`,
  );
  const wide = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  check(wide <= 0, `${label}: the page scrolls sideways by ${wide}px`);
  const small = await page.evaluate(() => {
    const grid = document
      .querySelector('[role="table"]')
      ?.closest('[class~="@container"]');
    const targets = grid?.querySelectorAll("input, button") ?? [];
    return [...targets]
      .map((e) => ({
        r: e.getBoundingClientRect(),
        n:
          e.getAttribute("aria-label") ??
          e.getAttribute("name") ??
          e.textContent?.slice(0, 24),
      }))
      .filter(({ r }) => r.width > 0 && r.height > 0 && r.height < 44)
      .map(({ r, n }) => `${n ?? "?"} ${Math.round(r.height)}px`);
  });
  if (touch)
    check(
      small.length === 0,
      `${label}: targets under 44px: ${small.slice(0, 4).join(", ")}`,
    );
}

async function typingSpeed(page, card, label) {
  await card.getByRole("button", { name: "Load 200 lines" }).click();
  const quantity = cell(page, "Quantity, line 100");
  await quantity.scrollIntoViewIfNeeded();
  await quantity.focus();
  await page.evaluate(() => {
    window.__lat = [];
    document.addEventListener(
      "keydown",
      () => {
        const t0 = performance.now();
        setTimeout(() => {
          requestAnimationFrame(() =>
            requestAnimationFrame(() =>
              window.__lat.push(performance.now() - t0),
            ),
          );
        }, 0);
      },
      true,
    );
  });
  for (const key of "12345") {
    await page.keyboard.press(key);
    await sleep(60);
  }
  await sleep(200);
  const lat = await page.evaluate(() => window.__lat);
  const sorted = [...lat].sort((a, b) => a - b);
  const line = `${label}: 200 lines, key to next frame: median ${sorted[Math.floor(sorted.length / 2)].toFixed(1)} ms, worst ${sorted.at(-1).toFixed(1)} ms over ${lat.length} keys`;
  report.push(line);
  console.log(line);
}

const VIEWPORTS = {
  1440: { width: 1440, height: 900 },
  1024: { width: 1024, height: 768 },
  390: { width: 390, height: 844 },
};

async function walk(browser, theme, size) {
  const narrow = size === 390;
  const touch = size !== 1440;
  const context = await browser.newContext({
    viewport: VIEWPORTS[size],
    hasTouch: touch,
    isMobile: narrow,
    colorScheme: theme,
    reducedMotion: "reduce",
  });
  await mockApi(context);
  await context.addCookies([{ name: "op_csrf", value: "walk", url: base }]);
  const page = await context.newPage();
  const label = `${theme} ${size}`;
  page.on("console", (m) => {
    if (m.type() === "error" && !/40[14]/.test(m.text())) {
      problems.push(`${label} console: ${m.text()}`);
    }
  });
  page.on("pageerror", (e) =>
    problems.push(`${label} page error: ${e.message}`),
  );

  await page.goto(`${base}/gallery`);
  await page
    .getByRole("heading", { level: 1, name: "Component gallery" })
    .waitFor();
  // The analytics question sits over the bottom of every picture otherwise.
  await page
    .getByRole("button", { name: "No thanks" })
    .click({ timeout: 3000 })
    .catch(() => undefined);
  const card = page.getByRole("region", { name: "Lines grid", exact: true });
  await card.scrollIntoViewIfNeeded();
  await page.getByRole("table", { name: "Order lines" }).waitFor();
  await sleep(300);
  await shoot(card, "support", theme, size);
  await layoutChecks(page, `${label} support`, touch, narrow);

  if (!narrow) {
    await entryWalk(page, label);
    await shoot(card, "after-entry", theme, size);
  }

  // The server refuses a quantity: it lands on line 2's cell and takes focus.
  await card.getByLabel("Fake server answer").click();
  await page
    .getByRole("option", { name: "Refuses the quantity on line 2" })
    .click();
  await card.getByRole("button", { name: "Save" }).click();
  await page.getByText("Only 8 units of I-0002").waitFor();
  check(
    await cell(page, "Quantity, line 2").evaluate(
      (e) => e === document.activeElement,
    ),
    `${label}: the server error did not take focus`,
  );
  await shoot(card, "server-error", theme, size);
  await layoutChecks(page, `${label} error`, touch, narrow);

  // A role that may not see prices, then the record read-only.
  await card.getByLabel("View as").click();
  await page.getByRole("option", { name: "Warehouse (prices masked)" }).click();
  await page.getByRole("table", { name: "Order lines" }).waitFor();
  check(
    (await page.getByRole("textbox", { name: /Unit price/ }).count()) === 0,
    `${label}: a masked price has a field`,
  );
  await shoot(card, "masked", theme, size);
  await card.getByRole("switch", { name: "Read only" }).click();
  await shoot(card, "read-only", theme, size);
  await layoutChecks(page, `${label} read-only`, touch, narrow);

  if (size === 1440 && theme === "light") {
    await card.getByRole("switch", { name: "Read only" }).click();
    await card.getByLabel("View as").click();
    await page.getByRole("option", { name: "Support (sees prices)" }).click();
    await typingSpeed(page, card, label);
  }
  await context.close();
}

async function run() {
  mkdirSync(outDir, { recursive: true });
  const preview = await startPreview();
  const browser = await chromium.launch();
  try {
    for (const theme of ["light", "dark"]) {
      for (const size of [1440, 1024, 390]) await walk(browser, theme, size);
    }
  } finally {
    await browser.close();
    preview.kill();
  }
  console.log(`${shots.length} screenshots in ${outDir}`);
  if (problems.length > 0) {
    console.error(problems.join("\n"));
    process.exit(1);
  }
  console.log("The walk found no problems.");
}

await run();
