import type { CopyRoleBody } from "@orderpilot/shared";
import {
  checkPage,
  expect,
  expectNoButton,
  expectRefused,
  signInAs,
  test,
} from "../src/index.js";

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
