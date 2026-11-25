import { request } from "@playwright/test";
import type { AuditEventView, CopyRoleBody } from "@orderpilot/shared";
import {
  BASE_URL,
  apiUrl,
  checkPage,
  expect,
  expectNoButton,
  expectRefused,
  signInAs,
  test,
} from "../src/index.js";
import { sessionFor } from "../src/session.js";

// The pattern every CRUD spec follows (CONTRIBUTING.md, "End-to-end tests"):
// an allowed role sees the action, and a role without the permission sees no
// button and is refused by the server. The matrix is the first screen with an
// action one role holds and another can read without.

const copy = {
  fromRole: "SUPPORT",
  toRole: "LOGISTICS",
} satisfies CopyRoleBody;

test.describe("Governance: the role and permission matrix", () => {
  test("the system admin can copy a role", async ({ page }) => {
    await signInAs(page, "SYSTEM_ADMIN");
    await page.goto("/governance");
    await expect(
      page.getByRole("button", { name: "Copy a role" }),
    ).toBeVisible();
  });

  test("an auditor reads the matrix, sees no copy button, and is refused", async ({
    page,
  }) => {
    await signInAs(page, "AUDITOR");
    await page.goto("/governance");
    await expect(
      page.getByRole("heading", { name: "Role and permission matrix" }),
    ).toBeVisible();
    await expectNoButton(page, "Copy a role");
    await expectRefused("AUDITOR", "POST", "/governance/matrix/copy", copy);
  });
});

test.describe("E2E #3: a direct call without the right", () => {
  test("a script is refused with a trace id, and the refusal shows in the audit viewer", async ({
    page,
  }) => {
    const traceId = await expectRefused(
      "WAREHOUSE",
      "POST",
      "/workflows/sprs/SPR-20261101-0001/approve",
      { comment: "Sent by a script, not through the app." },
    );
    expect(traceId).toMatch(/^e2e-/);

    await signInAs(page, "AUDITOR");
    // A refusal's record is its route pattern, so a filter finds the route,
    // and the trace id proves the row is this call's.
    const view = new URLSearchParams({
      entity: "ApiRoute",
      id: "POST /api/v1/workflows/sprs/:recordNo/approve",
      role: "WAREHOUSE",
      refusals: "1",
    });
    await page.goto(`/audit?${view.toString()}`);
    await checkPage(page);

    // Newest first, so the first row is the refusal just made.
    await page
      .getByRole("button", { name: /^Details of event/ })
      .first()
      .click();
    const details = page.getByRole("dialog");
    await expect(details).toContainText(traceId);
    await expect(details).toContainText("auth.permission.refused");
  });
});

test.describe("F-9: a refusal read in the audit viewer", () => {
  // The criterion asks for an auditor who sees a masked value. Every masking
  // rule for audit events shows its field to the auditor, so the masked side
  // is the system admin's, and the auditor sees the same value in full
  // (ADR 0064). ADR 0058 changes both halves: its step 4 gives the unmasked
  // view to the system admin, and its step 5 stops signing in as the auditor.
  // Warehouse never holds approvals.decide, so this call can never reject a
  // real SPR. The reject route keeps it apart from E2E #3's approve route,
  // which runs at the same time.
  const route = "POST /api/v1/workflows/sprs/:recordNo/reject";
  const isOneEvent = (url: string) =>
    /\/api\/v1\/audit\/events\/[0-9a-f-]{36}$/.test(new URL(url).pathname);

  test("filtered to refusals, the reason is masked with why for the system admin, and shown to the auditor", async ({
    page,
  }) => {
    const traceId = await expectRefused(
      "WAREHOUSE",
      "POST",
      "/workflows/sprs/SPR-20261101-0001/reject",
      { comment: "Sent by a script, not through the app." },
    );
    const api = await request.newContext({
      baseURL: BASE_URL,
      storageState: await sessionFor("WAREHOUSE"),
    });
    const me = (await (await api.get(apiUrl("/auth/me"))).json()) as {
      data: { user: { displayName: string } };
    };
    await api.dispose();
    const warehouse = me.data.user.displayName;

    // The system admin filters with the pickers, by name and by action.
    await signInAs(page, "SYSTEM_ADMIN");
    await page.goto(
      `/audit?${new URLSearchParams({ entity: "ApiRoute", id: route }).toString()}`,
    );
    await page.getByRole("switch", { name: "Refusals only" }).click();
    await page.getByRole("combobox", { name: "Action" }).click();
    await page
      .getByRole("option", { name: "auth.permission.refused", exact: true })
      .click();
    await page.getByRole("combobox", { name: "Person" }).click();
    await page.getByRole("option", { name: warehouse, exact: true }).click();
    await expect(page).toHaveURL(/refusals=1/);

    const adminRead = page.waitForResponse((res) => isOneEvent(res.url()));
    await page
      .getByRole("button", { name: /^Details of event/ })
      .first()
      .click();
    const details = page.getByRole("dialog");
    await expect(details).toContainText(traceId);
    const admin = (await (await adminRead).json()) as { data: AuditEventView };
    expect(admin.data.traceId).toBe(traceId);
    expect(admin.data.changes.find((c) => c.field === "reason")).toMatchObject({
      masked: true,
      reason: "policy",
      after: null,
    });
    await details.getByRole("button", { name: "Why is this hidden?" }).click();
    await expect(
      page.getByText("A data policy hides this from the screen."),
    ).toBeVisible();
    await checkPage(page);
    const view = page.url();

    // The auditor opens the same view and the same event.
    await page.context().clearCookies();
    await signInAs(page, "AUDITOR");
    const auditorRead = page.waitForResponse((res) => isOneEvent(res.url()));
    await page.goto(view);
    const auditor = (await (await auditorRead).json()) as {
      data: AuditEventView;
    };
    const reason = auditor.data.changes.find((c) => c.field === "reason");
    expect(reason).toMatchObject({ masked: false });
    const shown = reason?.after ?? "";
    expect(shown.length).toBeGreaterThan(0);
    await expect(page.getByRole("dialog")).toContainText(shown);
    expect(JSON.stringify(admin)).not.toContain(JSON.stringify(shown));
  });
});

test.describe("The audit log at the demo's screen width", () => {
  // Refusals carry the longest records (a route pattern), so they are the
  // widest view. At 1440 px the table must fit its card, so Details is in
  // view without scrolling sideways.
  test("fits its card at 1440 px, with Details in view", async ({ page }) => {
    await signInAs(page, "AUDITOR");
    await page.goto("/audit?refusals=1");
    // #276 asks for this with the side panel open, as it is by default.
    await expect(page.locator("[data-collapsed]")).toHaveAttribute(
      "data-collapsed",
      "false",
    );
    const details = page
      .getByRole("button", { name: /^Details of event/ })
      .first();
    await expect(details).toBeVisible();
    const fit = await page.locator("main table").evaluate((table) => ({
      scroll: table.parentElement?.scrollWidth ?? Infinity,
      client: table.parentElement?.clientWidth ?? 0,
    }));
    expect(fit.scroll).toBeLessThanOrEqual(fit.client);
    const button = await details.boundingBox();
    const card = await page
      .locator("main table")
      .evaluate((table) => table.parentElement?.getBoundingClientRect().right);
    expect((button?.x ?? 0) + (button?.width ?? 0)).toBeLessThanOrEqual(
      card ?? 0,
    );
  });
});

test.describe("The Refusals tab on a phone (#276)", () => {
  test("fits 390 px: its main panel does not scroll sideways", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await signInAs(page, "SYSTEM_ADMIN");
    await page.goto("/governance?tab=refusals");
    await expect(page.getByText(/"code": "FORBIDDEN"/)).toBeVisible();
    // The shell scrolls inside its main panel, so the document's own width
    // says nothing here: checkPage measures only the document. Measure the
    // panel itself.
    const fit = await page.locator("main").evaluate((main) => ({
      scroll: main.scrollWidth,
      client: main.clientWidth,
    }));
    expect(fit.scroll).toBeLessThanOrEqual(fit.client);
  });
});
