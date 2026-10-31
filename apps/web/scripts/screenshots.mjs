// Screenshots of the production build, in light and dark, for the pull request.
//
// It serves `dist/` with `vite preview` (so the CSP headers are the real ones),
// drives Chromium with Playwright, and answers /api calls from contract
// fixtures. No API, no database, no Docker. Run `pnpm build` first.
//
// Playwright is not a dependency of this repository yet (P-14 adds it
// properly). Install it anywhere outside the repository and point at it:
//   PLAYWRIGHT_DIR=/path/with/node_modules node apps/web/scripts/screenshots.mjs
// The script also fails on any CSP violation or console error it sees.

import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
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

// Synthetic personas, as in packages/shared (DEMO_PERSONAS).
const PERSONAS = {
  SYSTEM_ADMIN: "Daniel Koh",
  PRODUCT_MANAGER: "Priya Nair",
  APPROVER: "Janet Lim",
  SUPPORT: "Mei Tan",
  WAREHOUSE: "Hafiz Rahman",
  FINANCE: "Grace Ong",
  LOGISTICS: "Arjun Mehta",
  MANAGEMENT: "Sophia Chen",
  AUDITOR: "Lucas Wong",
};
const PERMISSIONS = {
  SYSTEM_ADMIN: [
    "users.read",
    "users.manage",
    "roles.manage",
    "settings.manage",
    "audit.read",
    "aiUsage.read",
  ],
  SUPPORT: ["orders.read", "documents.read", "documents.upload"],
  WAREHOUSE: ["orders.read", "documents.read"],
  MANAGEMENT: ["orders.read", "documents.read", "aiUsage.read"],
};

function sessionFor(role, expiresInMs = 15 * 60_000) {
  const index = Object.keys(PERSONAS).indexOf(role) + 1;
  return {
    user: {
      id: `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
      displayName: PERSONAS[role],
      email: `${role.toLowerCase().replaceAll("_", ".")}@example.test`,
      role,
    },
    permissions: PERMISSIONS[role] ?? ["orders.read", "documents.read"],
    expiresAt: new Date(Date.now() + expiresInMs).toISOString(),
    demo: true,
  };
}

const json = (status, body) => ({
  status,
  contentType: "application/json",
  body: JSON.stringify(body),
});
const unauthorised = (code) =>
  json(401, {
    error: { code, message: "n/a", details: null, traceId: "shot-trace" },
  });

/** Answers the auth contract. `state.session` null means signed out. */
async function mockApi(context, state) {
  await context.route("**/api/v1/**", async (route) => {
    const url = new URL(route.request().url());
    const key = `${route.request().method()} ${url.pathname.replace("/api/v1", "")}`;
    switch (key) {
      case "GET /auth/options":
        return route.fulfill(
          json(200, {
            data: {
              demoMode: true,
              demoRoles: Object.entries(PERSONAS).map(
                ([role, displayName]) => ({ role, displayName }),
              ),
            },
          }),
        );
      case "GET /auth/me":
        return route.fulfill(
          state.session
            ? json(200, { data: state.session })
            : unauthorised("UNAUTHENTICATED"),
        );
      case "POST /auth/refresh":
        return route.fulfill(
          state.session && !state.refreshFails
            ? json(200, { data: state.session })
            : unauthorised("SESSION_EXPIRED"),
        );
      case "POST /auth/demo-login": {
        state.session = sessionFor(route.request().postDataJSON().role);
        return route.fulfill({
          ...json(200, { data: state.session }),
          headers: { "set-cookie": "op_csrf=shot-token; Path=/" },
        });
      }
      case "POST /auth/logout":
        state.session = null;
        return route.fulfill(json(200, { data: { ok: true } }));
      default:
        return route.fulfill(unauthorised("UNAUTHENTICATED"));
    }
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
      if (!csp.includes("script-src 'self'"))
        throw new Error("preview sent no CSP");
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

async function shoot(page, name, theme) {
  await page.waitForLoadState("networkidle");
  await sleep(450); // let route and dialog animations finish
  const file = path.join(outDir, `web-shell-${name}-${theme}.png`);
  await page.screenshot({ path: file });
  shots.push(file);
}

async function run() {
  mkdirSync(outDir, { recursive: true });
  const preview = await startPreview();
  const browser = await chromium.launch();
  try {
    for (const theme of ["light", "dark"]) {
      const context = await browser.newContext({
        viewport: { width: 1280, height: 800 },
        colorScheme: theme,
        reducedMotion: "reduce",
      });
      const state = { session: null, refreshFails: false };
      await mockApi(context, state);
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

      // Signed out: the login page with the demo roles.
      await page.goto(`${base}/login`);
      await page.getByRole("list", { name: "Demo roles" }).waitFor();
      await shoot(page, "login", theme);

      // Demo sign-in as support, then the role home.
      await page.getByRole("button", { name: /Support/ }).click();
      await page.getByRole("heading", { name: /Welcome/ }).waitFor();
      await shoot(page, "home-support", theme);

      await page.goto(`${base}/orders`);
      await page.getByText("What arrives here").waitFor();
      await shoot(page, "planned-orders", theme);

      await page.getByRole("button", { name: "Search or jump to" }).click();
      await page.getByRole("combobox").waitFor();
      await shoot(page, "command-palette", theme);
      await page.keyboard.press("Escape");

      await page.goto(`${base}/settings`);
      await page.getByRole("heading", { name: "Settings" }).waitFor();
      await shoot(page, "settings", theme);

      await page.goto(`${base}/nowhere`);
      await page.getByRole("heading", { name: "Page not found" }).waitFor();
      await shoot(page, "not-found", theme);

      // Another role: management has a different menu and tiles.
      state.session = sessionFor("MANAGEMENT");
      await page.goto(`${base}/`);
      await page
        .getByRole("heading", { name: "Welcome, Sophia Chen" })
        .waitFor();
      await shoot(page, "home-management", theme);

      // A role that may not open an area.
      state.session = sessionFor("WAREHOUSE");
      await page.goto(`${base}/governance`);
      await page
        .getByRole("heading", { name: "You do not have access" })
        .waitFor();
      await shoot(page, "forbidden", theme);

      // A session that ends while the page is open: the dialog sits over it.
      state.session = sessionFor("SUPPORT", 65_000);
      await page.goto(`${base}/settings`);
      await page.getByRole("heading", { name: "Settings" }).waitFor();
      state.refreshFails = true;
      await page
        .getByRole("dialog", { name: "Your session ended" })
        .waitFor({ timeout: 15_000 });
      await shoot(page, "session-ended", theme);

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
