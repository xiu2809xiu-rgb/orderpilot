import type { CopyRoleBody } from "@orderpilot/shared";
import {
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
