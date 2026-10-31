// Screenshots of the common components (the /gallery route) from the
// production build, in light and dark. It also downloads a CSV and an Excel
// file through the real export menu, to prove ExcelJS loads under the strict
// CSP. No API, no database, no Docker. Run `pnpm build` first.
//
// Playwright is not a dependency of this repository yet (P-14 adds it
// properly). Install it anywhere outside the repository and point at it:
//   PLAYWRIGHT_DIR=/path/with/node_modules node apps/web/scripts/screenshots-components.mjs

import { spawn } from "node:child_process";
import { mkdirSync, readFileSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { setTimeout as sleep } from "node:timers/promises";

const webDir = path.resolve(import.meta.dirname, "..");
const outDir = path.resolve(webDir, "../../docs/design/screenshots/platform");
const port = process.env.WEB_PORT ?? "4173";
const base = `http://localhost:${port}`;

const playwrightDir = process.env.PLAYWRIGHT_DIR;
if (!playwrightDir)
  throw new Error("Set PLAYWRIGHT_DIR (see the top of this file).");
const { chromium } = createRequire(path.join(playwrightDir, "x.js"))(
  "playwright",
);

// A synthetic auditor, so the audit link shows.
const session = {
  user: {
    id: "00000000-0000-4000-8000-000000000009",
    displayName: "Lucas Wong",
    email: "auditor@example.test",
    role: "AUDITOR",
  },
  permissions: ["orders.read", "audit.read", "aiUsage.read"],
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
    const url = new URL(route.request().url());
    const key = url.pathname.replace("/api/v1", "");
    if (key === "/auth/me") return route.fulfill(json(200, { data: session }));
    if (key === "/auth/options")
      return route.fulfill(
        json(200, { data: { demoMode: true, demoRoles: [] } }),
      );
    return route.fulfill(
      json(401, {
        error: {
          code: "UNAUTHENTICATED",
          message: "n/a",
          details: null,
          traceId: "shot",
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
      const response = await fetch(base);
      const csp = response.headers.get("content-security-policy") ?? "";
      if (!csp.includes("script-src 'self'")) throw new Error("no CSP");
      return child;
    } catch (error) {
      if (String(error).includes("no CSP")) throw error;
      await sleep(200);
    }
  }
  throw new Error("vite preview did not start");
}

const problems = [];
const shots = [];

async function shoot(target, name, theme) {
  const file = path.join(outDir, `components-${name}-${theme}.png`);
  await target.screenshot({ path: file });
  shots.push(file);
}

/** A region with room around it, so a popover that opens outside it shows. */
async function shootAround(page, locator, name, theme, pad) {
  await locator.scrollIntoViewIfNeeded();
  const box = await locator.boundingBox();
  const view = page.viewportSize();
  const x = Math.max(0, box.x - pad);
  const y = Math.max(0, box.y - pad / 2);
  const file = path.join(outDir, `components-${name}-${theme}.png`);
  await page.screenshot({
    path: file,
    clip: {
      x,
      y,
      width: Math.min(view.width - x, box.width + pad * 2),
      height: Math.min(view.height - y, box.height + pad * 2),
    },
  });
  shots.push(file);
}

/** Downloads through the export menu and checks what arrives. */
async function checkExports(page, theme) {
  for (const [label, ext] of [
    ["Export as CSV", "csv"],
    ["Export as Excel", "xlsx"],
  ]) {
    await page.getByRole("button", { name: "Export" }).click();
    const waiting = page.waitForEvent("download", { timeout: 20_000 });
    await page.getByRole("menuitem", { name: label }).click();
    const download = await waiting;
    const file = path.join(
      process.env.TEMP ?? ".",
      `gallery-${theme}-${download.suggestedFilename()}`,
    );
    await download.saveAs(file);
    const bytes = readFileSync(file);
    const ok =
      ext === "xlsx"
        ? bytes.subarray(0, 2).toString() === "PK" && statSync(file).size > 1000
        : bytes.toString("utf8").includes("SO-20261030-0001");
    if (!ok) problems.push(`${theme}: the ${ext} export is not what we expect`);
    else console.log(`${theme}: ${ext} export ok (${bytes.length} bytes)`);
  }
}

async function run() {
  mkdirSync(outDir, { recursive: true });
  const preview = await startPreview();
  const browser = await chromium.launch();
  try {
    for (const theme of ["light", "dark"]) {
      const context = await browser.newContext({
        viewport: { width: 1280, height: 900 },
        colorScheme: theme,
        reducedMotion: "reduce",
        acceptDownloads: true,
      });
      await mockApi(context);
      // A returning visitor: the page asks the API who is signed in.
      await context.addCookies([
        { name: "op_csrf", value: "shot-token", url: base },
      ]);
      const page = await context.newPage();
      page.on("console", (message) => {
        if (
          message.type() === "error" &&
          !/Failed to load resource.*401/.test(message.text())
        )
          problems.push(`${theme} console: ${message.text()}`);
      });
      page.on("pageerror", (error) =>
        problems.push(`${theme} page error: ${error.message}`),
      );
      await page.addInitScript(() => {
        document.addEventListener("securitypolicyviolation", (event) => {
          console.error(
            `CSP violation: ${event.violatedDirective} ${event.blockedURI}`,
          );
        });
      });

      await page.goto(`${base}/gallery`);
      await page
        .getByRole("heading", { level: 1, name: "Component gallery" })
        .waitFor();
      await page.waitForLoadState("networkidle");

      const card = (name) => page.getByRole("region", { name, exact: true });

      // The table with a search, a switch and a sort applied.
      await page.getByRole("searchbox", { name: "Search" }).fill("harbour");
      await page.getByRole("switch", { name: "Show active only" }).check();
      await page.getByRole("button", { name: "Total (USD)" }).click();
      await page.getByText("Showing 1 to").waitFor();
      await sleep(500);
      await shoot(card("Data table"), "data-table", theme);

      await checkExports(page, theme);

      // Column settings and saved filters open.
      await page.getByRole("button", { name: "Columns" }).click();
      await shoot(page, "column-settings", theme);
      await page.keyboard.press("Escape");
      await page.getByRole("button", { name: "Saved filters" }).click();
      await page.getByLabel("Name for this filter").fill("Harbour, active");
      await page.getByRole("button", { name: "Save current filter" }).click();
      await shoot(page, "saved-filters", theme);
      await page.keyboard.press("Escape");

      // The table in its error state, with a trace id.
      await page.getByRole("button", { name: "Show an error" }).click();
      await page.getByText("trace-demo-0001").waitFor();
      await shoot(card("Data table"), "data-table-error", theme);

      await card("Page states").scrollIntoViewIfNeeded();
      await shoot(card("Page states"), "states", theme);
      await shoot(card("Badges"), "badges", theme);

      await page
        .getByRole("button", { name: "Why is this hidden?" })
        .first()
        .click();
      await page.getByText("Why this is hidden").waitFor();
      await shootAround(page, card("Small pieces"), "small-pieces", theme, 70);
      await page.keyboard.press("Escape");
      await shoot(card("Operation log"), "operation-log", theme);

      await context.close();
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
  console.log("No CSP violations or console errors.");
}

await run();
