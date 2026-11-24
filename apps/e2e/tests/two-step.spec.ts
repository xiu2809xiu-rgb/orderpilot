import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { request, type Page } from "@playwright/test";
import { authRoutes, HEADERS, twoStepRoutes } from "@orderpilot/shared";
import { checkPage, expect, test } from "../src/index.js";
import { apiUrl, BASE_URL, ORIGIN, SESSION_DIR } from "../src/env.js";
import { csrfToken, demoSignIn } from "../src/session.js";
import { codeAt, nextStep, stepOf } from "../src/totp.js";

// Two-step sign-in, from the Settings card to the sign-in page and back (ADR
// 0067). It runs on the Management account, signed in by PASSWORD through the
// page, because the demo role buttons skip the second step by design. The
// account is a base record, so CI has it.
//
// The rule that keeps CI honest: this spec never starts from, and never leaves
// behind, a Management account with two-step on. It is never retried, writes
// what it would need to undo its own work to a git-ignored file as soon as
// each piece arrives, and undoes it in `finally` and again in `beforeAll` of
// the next run. It calls no administrator reset: that would end every session
// of the account, the demo sessions other specs hold included.

test.describe.configure({ mode: "serial", retries: 0 });

const EMAIL = "management@example.test";
// The compose default, which is what CI runs with. A stack with another
// password passes it in DEMO_PASSWORD, as the stack itself reads it.
const PASSWORD = process.env.DEMO_PASSWORD ?? "orderpilot-demo-password";
const STATE_FILE = path.join(SESSION_DIR, "two-step-state.json");
const FIX_NOTE =
  "Two-step is on for MANAGEMENT and this run holds no codes for it: reset the database, or reset it as the System admin (POST /api/v1/users/:id/two-step/reset).";

interface State {
  /** The setup key, once the dialog shows it. */
  setupKey?: string;
  /** The ten recovery codes, once the enable call answers. */
  recoveryCodes?: string[];
  /** The last step a six-digit code used. */
  lastStep?: number;
}

async function readState(): Promise<State | null> {
  try {
    return JSON.parse(await readFile(STATE_FILE, "utf8")) as State;
  } catch {
    return null;
  }
}

async function writeState(state: State): Promise<void> {
  await mkdir(SESSION_DIR, { recursive: true });
  // Written then renamed, as storeSession does, so a reader never sees half.
  const partial = `${STATE_FILE}.${String(process.pid)}.tmp`;
  await writeFile(partial, JSON.stringify(state));
  await rename(partial, STATE_FILE);
}

/** Calls the API as a fresh demo session of Management, which has no password step. */
type Call = (
  route: string,
  method: "GET" | "POST",
  data?: unknown,
) => Promise<{ status: number; body: unknown }>;

async function asDemoManagement<T>(
  use: (call: Call) => Promise<T>,
): Promise<T> {
  const api = await request.newContext({ baseURL: BASE_URL });
  try {
    await demoSignIn(api, "MANAGEMENT");
    const token = csrfToken(await api.storageState());
    return await use(async (route, method, data) => {
      const res = await api.fetch(apiUrl(route), {
        method,
        ...(data === undefined ? {} : { data }),
        headers: { Origin: ORIGIN, [HEADERS.csrf]: token },
      });
      return { status: res.status(), body: await res.json() };
    });
  } finally {
    await api.dispose();
  }
}

/** Puts Management back to two-step off, from what the state file holds. */
async function turnOffFromState(state: State): Promise<void> {
  await asDemoManagement(async (call) => {
    const status = await call(twoStepRoutes.status.path, "GET");
    const data = (status.body as { data?: { state?: string } }).data;
    if (data?.state !== "on") return;
    const [recovery] = state.recoveryCodes ?? [];
    if (recovery !== undefined) {
      const done = await call(twoStepRoutes.disable.path, "POST", {
        recoveryCode: recovery,
      });
      if (done.status !== 200) {
        throw new Error(
          `Could not turn two-step off with a stored recovery code: ${String(done.status)}.`,
        );
      }
      return;
    }
    if (state.setupKey === undefined) throw new Error(FIX_NOTE);
    // Only the key was stored: try the steps the server could still take.
    const now = stepOf(new Date());
    for (const step of [now + 1, now, now - 1]) {
      const done = await call(twoStepRoutes.disable.path, "POST", {
        code: codeAt(state.setupKey, step),
      });
      if (done.status === 200) return;
    }
    throw new Error(
      "Could not turn two-step off with a code made from the stored key.",
    );
  });
}

/** Heals a run that was killed, or fails at once with the fix named. */
async function startClean(): Promise<void> {
  const state = await readState();
  if (state) {
    await turnOffFromState(state);
    await rm(STATE_FILE, { force: true });
    return;
  }
  const api = await request.newContext({ baseURL: BASE_URL });
  try {
    const res = await api.post(apiUrl(authRoutes.login.path), {
      data: { email: EMAIL, password: PASSWORD },
      headers: { Origin: ORIGIN },
    });
    if (res.status() === 401) {
      const body = (await res.json()) as { error?: { code?: string } };
      if (body.error?.code === "TWO_STEP_REQUIRED") throw new Error(FIX_NOTE);
    }
  } finally {
    await api.dispose();
  }
}

async function signInByPassword(page: Page): Promise<void> {
  await page.goto("/login");
  await page.getByRole("button", { name: "Sign in with email" }).click();
  await page.getByLabel("Email", { exact: true }).fill(EMAIL);
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
}

async function typeCode(page: Page, code: string): Promise<void> {
  await page
    .getByRole("textbox", { name: "6-digit code" })
    .pressSequentially(code);
}

test.beforeAll(async () => {
  await startClean();
});

test("turns two-step on, signs in with the second step, and turns it off with a recovery code", async ({
  page,
}) => {
  let state: State = {};
  try {
    await test.step("Management signs in with the password", async () => {
      await signInByPassword(page);
      await expect(page).toHaveURL((url) => url.pathname !== "/login");
    });

    const card = page.getByRole("region", { name: "Two-step verification" });
    const dialog = page.getByRole("dialog");

    await test.step("turns two-step on from Settings, Account", async () => {
      await page.goto("/settings?section=account");
      await expect(card.getByText("Off", { exact: true })).toBeVisible();
      await card.getByRole("button", { name: "Turn on" }).click();
      await dialog.getByLabel("Password", { exact: true }).fill(PASSWORD);
      await dialog.getByRole("button", { name: "Continue" }).click();
      // The key is always shown as text, so the test needs no camera.
      const key = (await page.getByTestId("setup-key").innerText()).replace(
        /\s/g,
        "",
      );
      state = { setupKey: key };
      await writeState(state);

      // Registered before the click that sends the code, so the codes are
      // stored the moment they arrive and not when the page draws them.
      const answer = page.waitForResponse(
        (res) =>
          res.url().endsWith("/auth/two-step/enable") &&
          res.request().method() === "POST",
      );
      const first = nextStep(null, new Date());
      await typeCode(page, codeAt(key, first));
      const body = (await (await answer).json()) as {
        data: { recoveryCodes: string[] };
      };
      state = {
        setupKey: key,
        recoveryCodes: body.data.recoveryCodes,
        lastStep: first,
      };
      await writeState(state);

      await expect(
        dialog.getByRole("heading", { name: "Save your recovery codes" }),
      ).toBeVisible();
      await dialog
        .getByRole("checkbox", { name: "I have saved these codes" })
        .click();
      await dialog.getByRole("button", { name: "Done" }).click();
      await expect(card.getByText("On", { exact: true })).toBeVisible();
      await expect(card.getByText("10 codes left")).toBeVisible();
    });

    await test.step("the card and its states pass the page check at both sizes", async () => {
      await checkPage(page);
    });

    await test.step("signs out and signs in again, this time with a code", async () => {
      await page.getByRole("button", { name: "Account menu" }).click();
      await page.getByRole("menuitem", { name: "Sign out" }).click();
      await expect(page).toHaveURL((url) => url.pathname === "/login");
      await signInByPassword(page);
      await expect(
        page.getByRole("heading", { name: "Enter your code" }),
      ).toBeVisible();
      // The code that turned two-step on is spent: the next step is the one to use.
      const second = nextStep(state.lastStep ?? null, new Date());
      await typeCode(page, codeAt(state.setupKey ?? "", second));
      state = { ...state, lastStep: second };
      await writeState(state);
      await expect(page).toHaveURL((url) => url.pathname !== "/login");
    });

    await test.step("turns two-step off with a recovery code", async () => {
      await page.goto("/settings?section=account");
      await card.getByRole("button", { name: "Turn off" }).click();
      await dialog.getByLabel("Password", { exact: true }).fill(PASSWORD);
      await dialog
        .getByRole("button", { name: "Use a recovery code instead" })
        .click();
      await dialog
        .getByLabel("Recovery code", { exact: true })
        .fill(state.recoveryCodes?.[0] ?? "");
      await dialog.getByRole("button", { name: "Turn off" }).click();
      await expect(card.getByRole("button", { name: "Turn on" })).toBeVisible();
      await rm(STATE_FILE, { force: true });
    });
  } finally {
    // Whatever failed above, Management leaves with two-step off, or this
    // fails loudly. Nothing here depends on the page.
    const left = await readState();
    if (left) {
      await turnOffFromState(left);
      await rm(STATE_FILE, { force: true });
    }
  }
});
